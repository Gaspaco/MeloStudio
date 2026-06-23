// The `useTransport` hook orchestrates playback across all audio sub-systems.
// In a DAW, the "Transport" refers to the global play/pause/record controls and timeline playhead.
// This hook bridges the Web Audio API, Tone.js (for drums), the PolySynth (for MIDI), 
// and raw AudioBuffers (for audio clips). When the user clicks play, it schedules 
// all upcoming clips to play at precisely the right moment on the audio context thread,
// and starts a visual `requestAnimationFrame` loop to animate the playhead smoothly.
import { createEffect, onCleanup, untrack } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { apiFetch } from "~/lib/api";
import { unlockAudioContext, getAudioContext } from "~/lib/audio/context";
import { getMasterBus } from "~/lib/audio/masterBus";
import type { StepPattern, StepSequencer } from "~/lib/audio/stepSeq";
import type { PolySynth, SynthPreset } from "~/lib/audio/synth";
import { hasPatternContent, isAudioTrackType, isInstrumentTrackType, type UITrack } from "../types";
import { STUDIO_BAR_PX } from "../lib/regionMath";

type Deps = {
  getSeq: () => StepSequencer | null;
  getSynth: () => PolySynth | null;
  ensureSynth?: (preset: SynthPreset) => void;
  tracks: Accessor<UITrack[]>;
  bpm: Accessor<number>; setBpm: Setter<number>;
  playing: Accessor<boolean>; setPlaying: Setter<boolean>;
  elapsed: Accessor<number>; setElapsed: Setter<number>;
  masterVol: Accessor<number>; setMasterVol: Setter<number>;
  playheadPx: Accessor<number>; setPlayheadPx: Setter<number>;
  pattern: Accessor<StepPattern>; setPattern: Setter<StepPattern>;
  loopEnabled: Accessor<boolean>;
  cycleStartPx: Accessor<number>;
  cycleEndPx: Accessor<number>;
};

export function useTransport(deps: Deps) {
  let audioSources: AudioBufferSourceNode[] = [];
  let playbackRaf: number | null = null;
  let playbackStartCtxTime = 0;
  let playbackStartTimelineSecs = 0;
  const audioBufferCache = new Map<string, AudioBuffer>();
  // URLs that returned a non-OK response — skip them for the rest of the session
  // so a missing remote clip doesn't cause repeated 404s on every play press.
  const failedSrcCache = new Set<string>();
  let masterGainNode: GainNode | null = null;
  const trackGainNodes = new Map<string, GainNode>();
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let midiTimers: ReturnType<typeof setTimeout>[] = [];
  let cycleBoundaryTimer: ReturnType<typeof setTimeout> | null = null;
  let startTime = 0;
  let playbackRunId = 0;

  // One bar = 4 beats; one beat = 60 / bpm seconds.
  const barsToSecs = (bars: number) => bars * 4 * (60 / deps.bpm());
  const pxToSecs   = (px: number)   => (px / STUDIO_BAR_PX) * 4 * (60 / deps.bpm());
  const secsToPx   = (secs: number) => secs * (deps.bpm() / 60) * (STUDIO_BAR_PX / 4);
  // `optional=1` tells the server to return 204 instead of 404 for a missing clip, so the scheduler can silently skip it
  const optionalRemoteUrl = (src: string) =>
    src.includes("optional=") ? src : `${src}${src.includes("?") ? "&" : "?"}optional=1`;

  const shouldRunDrumSequencer = () =>
    deps.tracks().some(track => track.type === "drum" && !track.muted) && hasPatternContent(deps.pattern());

  const audioTracks = () =>
    deps.tracks().filter(track => isAudioTrackType(track.type));

  const instrumentTracks = () =>
    deps.tracks().filter(track => isInstrumentTrackType(track.type));

  const synthPresetForTrack = (track: UITrack): SynthPreset =>
    track.instrumentPreset ?? (track.type === "bass" ? "bass" : track.type === "guitar" ? "guitar" : "piano");

  const isPlaybackRunActive = (runId: number) =>
    runId === playbackRunId && deps.playing();

  const cycleBounds = () => {
    const rawStartPx = Math.max(0, Math.min(deps.cycleStartPx(), deps.cycleEndPx()));
    const rawEndPx = Math.max(deps.cycleStartPx(), deps.cycleEndPx());
    const endPx = Math.max(rawStartPx + STUDIO_BAR_PX / 16, rawEndPx);
    return {
      enabled: deps.loopEnabled(),
      startPx: rawStartPx,
      endPx,
      startSecs: pxToSecs(rawStartPx),
      endSecs: pxToSecs(endPx),
    };
  };

  const normalizedPlaybackStartPx = (requestedPx: number) => {
    const bounds = cycleBounds();
    const px = Math.max(0, requestedPx);
    if (!bounds.enabled) return px;
    return px >= bounds.startPx && px < bounds.endPx ? px : bounds.startPx;
  };

  const stopAudioPlayback = () => {
    playbackRunId++;
    for (const src of audioSources) { try { src.stop(); } catch { /* already ended */ } }
    audioSources = [];
    if (playbackRaf) { cancelAnimationFrame(playbackRaf); playbackRaf = null; }
    if (cycleBoundaryTimer) { clearTimeout(cycleBoundaryTimer); cycleBoundaryTimer = null; }
    for (const timer of midiTimers) clearTimeout(timer);
    midiTimers = [];
    deps.getSynth()?.allNotesOff();
    trackGainNodes.forEach((n) => { try { n.disconnect(); } catch { /* */ } });
    trackGainNodes.clear();
    if (masterGainNode) { try { masterGainNode.disconnect(); } catch { /* */ } masterGainNode = null; }
  };

  const scheduleMidiPlayback = (timelineStartSecs: number, segmentEndSecs: number, runId: number) => {
    let synth = deps.getSynth();
    if (!synth) {
      const firstPlayableMidiTrack = instrumentTracks().find(track =>
        !track.muted && (track.clips ?? []).some(clip =>
          clip.kind === "midi" &&
          Boolean(clip.midiNotes?.length) &&
          barsToSecs(clip.barStart + clip.bars) > timelineStartSecs &&
          barsToSecs(clip.barStart) < segmentEndSecs
        )
      );
      if (firstPlayableMidiTrack) {
        deps.ensureSynth?.(synthPresetForTrack(firstPlayableMidiTrack));
        synth = deps.getSynth();
      }
    }
    if (!synth) return;

    for (const track of instrumentTracks()) {
      if (track.muted) continue;
      const trackPreset = synthPresetForTrack(track);
      for (const clip of track.clips ?? []) {
        if (clip.kind !== "midi" || !clip.midiNotes?.length) continue;
        const clipStartSecs = barsToSecs(clip.barStart);
        const clipEndSecs = barsToSecs(clip.barStart + clip.bars);
        if (clipEndSecs <= timelineStartSecs) continue;
        if (clipStartSecs >= segmentEndSecs) continue;

        for (const note of clip.midiNotes) {
          const noteStartSecs = clipStartSecs + barsToSecs(note.startBars);
          const noteDurationSecs = barsToSecs(note.durationBars);
          const noteEndSecs = noteStartSecs + noteDurationSecs;
          if (noteEndSecs <= timelineStartSecs) continue;
          if (noteStartSecs >= segmentEndSecs) continue;

          const delayMs = Math.max(0, (noteStartSecs - timelineStartSecs) * 1000);
          const clippedEndSecs = Math.min(noteEndSecs, segmentEndSecs);
          const durationMs = Math.max(20, (clippedEndSecs - Math.max(noteStartSecs, timelineStartSecs)) * 1000);
          const midi = Math.max(0, Math.min(127, Math.round(note.midi)));
          const velocity = Math.max(0.05, Math.min(1, note.velocity));

          const onTimer = setTimeout(() => {
            if (!isPlaybackRunActive(runId)) return;
            if (synthPresetForTrack(track) === trackPreset) synth.setPreset(trackPreset);
            synth.noteOn(midi, velocity * (track.volume ?? 1));
            const offTimer = setTimeout(() => {
              if (isPlaybackRunActive(runId)) synth.noteOff(midi);
            }, durationMs);
            midiTimers.push(offTimer);
          }, delayMs);
          midiTimers.push(onTimer);
        }
      }
    }
  };

  const setTrackVolume = (trackId: string, v: number) => {
    const node = trackGainNodes.get(trackId);
    if (node) node.gain.setTargetAtTime(Math.max(0, v), getAudioContext().currentTime, 0.01);
  };

  const startAudioPlayback = async (requestedStartPx = deps.playheadPx()) => {
    stopAudioPlayback();
    const runId = playbackRunId;
    const ctx = getAudioContext();
    const playbackStartPx = normalizedPlaybackStartPx(requestedStartPx);
    if (Math.abs(playbackStartPx - deps.playheadPx()) > 0.5) deps.setPlayheadPx(playbackStartPx);
    const timelineStartSecs = pxToSecs(playbackStartPx);
    playbackStartCtxTime    = ctx.currentTime;
    playbackStartTimelineSecs = timelineStartSecs;

    // Loop end: cycle locator when enabled, otherwise last audio/MIDI clip end or sequencer length.
    const audioEnds = audioTracks().flatMap(t =>
      (t.clips ?? []).filter(c => c.url || c.remoteUrl).map(c => (c.barStart + c.bars) * STUDIO_BAR_PX)
    );
    const midiEnds = instrumentTracks().flatMap(t =>
      (t.clips ?? []).filter(c => c.kind === "midi").map(c => (c.barStart + c.bars) * STUDIO_BAR_PX)
    );
    const patternBars = (deps.pattern().steps ?? 16) / 16; // 16 steps = 1 bar
    const arrangementEndPx = [...audioEnds, ...midiEnds].length > 0 ? Math.max(...audioEnds, ...midiEnds) : patternBars * STUDIO_BAR_PX;
    const bounds = cycleBounds();
    const segmentEndSecs = bounds.enabled ? bounds.endSecs : pxToSecs(arrangementEndPx);

    const doLoop = () => {
      deps.setPlayheadPx(bounds.startPx);
      startTime = performance.now();
      deps.setElapsed(bounds.startSecs);
      stopAudioPlayback();
      void startAudioPlayback(bounds.startPx);
    };

    const tickPlayhead = () => {
      const el = getAudioContext().currentTime - playbackStartCtxTime;
      const currentSecs = playbackStartTimelineSecs + el;
      const liveBounds = cycleBounds();
      if (!isPlaybackRunActive(runId)) return;
      if (liveBounds.enabled && currentSecs >= liveBounds.endSecs) {
        doLoop();
        return;
      }
      const newPx = secsToPx(currentSecs);
      deps.setPlayheadPx(newPx);
      deps.setElapsed(currentSecs);
      playbackRaf = requestAnimationFrame(tickPlayhead);
    };
    playbackRaf = requestAnimationFrame(tickPlayhead);

    if (bounds.enabled) {
      const boundaryDelayMs = Math.max(0, (bounds.endSecs - timelineStartSecs) * 1000);
      cycleBoundaryTimer = setTimeout(() => {
        if (!deps.playing()) return;
        if (!isPlaybackRunActive(runId)) return;
        doLoop();
      }, boundaryDelayMs);
    }

    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = deps.masterVol();
    masterGainNode.connect(getMasterBus().input);

    for (const track of audioTracks()) {
      const hasAudioClips = (track.clips ?? []).some(c => (c.kind === "audio" || c.kind === "video") && (!!c.url || !!c.remoteUrl));
      if (!hasAudioClips) continue;

      // Per-track gain node so each track's volume slider works independently
      const trackGain = ctx.createGain();
      trackGain.gain.value = track.muted ? 0 : (track.volume ?? 1);
      trackGain.connect(masterGainNode!);
      trackGainNodes.set(track.id, trackGain);

      for (const clip of track.clips ?? []) {
        if (clip.kind !== "audio" && clip.kind !== "video") continue;
        // Use local blob URL if available, fall back to server URL for cross-session clips
        const audioSrc = clip.url || clip.remoteUrl;
        if (!audioSrc) continue;
        if (failedSrcCache.has(audioSrc)) continue;
        let buffer = audioBufferCache.get(audioSrc);
        if (!buffer) {
          try {
            const requestSrc = audioSrc.startsWith("/api/") ? optionalRemoteUrl(audioSrc) : audioSrc;
            const res = audioSrc.startsWith("/api/") ? await apiFetch(requestSrc) : await fetch(requestSrc);
            if (res.status === 204 || !res.ok) { failedSrcCache.add(audioSrc); continue; }
            const ab = await res.arrayBuffer();
            if (!isPlaybackRunActive(runId)) return;
            buffer = await ctx.decodeAudioData(ab);
            if (!isPlaybackRunActive(runId)) return;
            audioBufferCache.set(audioSrc, buffer);
          } catch { failedSrcCache.add(audioSrc); continue; }
        }
        if (!isPlaybackRunActive(runId)) return;
        const clipStartSecs = barsToSecs(clip.barStart);
        const clipDurationSecs = barsToSecs(clip.bars);
        const clipEndSecs   = clipStartSecs + clipDurationSecs;
        if (clipEndSecs <= timelineStartSecs) continue;
        if (clipStartSecs >= segmentEndSecs) continue;
        const playStartSecs = Math.max(clipStartSecs, timelineStartSecs);
        const playEndSecs = Math.min(clipEndSecs, segmentEndSecs);
        const offsetInClip = Math.max(0, playStartSecs - clipStartSecs);
        const delayFromNow = Math.max(0, playStartSecs - timelineStartSecs);
        const sourceOffsetSecs = barsToSecs(clip.sourceOffsetBars ?? 0);
        const playableSecs = Math.max(0, playEndSecs - playStartSecs);
        if (playableSecs <= 0) continue;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(trackGain);
        src.start(ctx.currentTime + delayFromNow, sourceOffsetSecs + offsetInClip, playableSecs);
        audioSources.push(src);
      }
    }

    if (!isPlaybackRunActive(runId)) return;
    scheduleMidiPlayback(timelineStartSecs, segmentEndSecs, runId);
  };

  const togglePlay = async () => {
    const seq = deps.getSeq();
    await unlockAudioContext();
    if (deps.playing()) {
      seq?.stop();
      deps.setPlaying(false);
      if (elapsedTimer) clearInterval(elapsedTimer);
      elapsedTimer = null;
      stopAudioPlayback();
    } else {
      if (shouldRunDrumSequencer()) await seq?.start();
      else seq?.stop();
      deps.setPlaying(true);
      startTime = performance.now();
      await startAudioPlayback();
    }
  };

  const stopAll = () => {
    const seq = deps.getSeq();
    seq?.stop();
    deps.setPlaying(false);
    deps.setElapsed(0);
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = null;
    stopAudioPlayback();
    deps.setPlayheadPx(0);
  };

  const updateBpm = (v: number) => {
    const seq = deps.getSeq();
    const clamped = Math.max(40, Math.min(240, Number.isFinite(v) ? v : 100));
    deps.setBpm(clamped);
    if (seq) {
      seq.setBpm(clamped);
      deps.setPattern({ ...seq.getPattern() });
    }
  };

  const setMasterVolume = (v: number) => {
    deps.setMasterVol(v);
    const db = v <= 0.001 ? -60 : 20 * Math.log10(v);
    const seq = deps.getSeq();
    if (seq) seq.setMasterGainDb(db);
    const synth = deps.getSynth();
    if (synth) synth.setMasterGainDb(db);
    if (masterGainNode) masterGainNode.gain.setTargetAtTime(v, getAudioContext().currentTime, 0.01);
  };

  onCleanup(() => {
    stopAudioPlayback();
    if (elapsedTimer) clearInterval(elapsedTimer);
  });

  let lastCycleSignature = "";
  createEffect(() => {
    const signature = `${deps.loopEnabled()}|${deps.cycleStartPx()}|${deps.cycleEndPx()}|${deps.bpm()}`;
    if (lastCycleSignature && deps.playing()) untrack(() => { void startAudioPlayback(); });
    lastCycleSignature = signature;
  });

  return { togglePlay, stopAll, updateBpm, setMasterVolume, stopAudioPlayback, setTrackVolume };
}
