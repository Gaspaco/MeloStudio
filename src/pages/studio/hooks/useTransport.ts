import { createEffect, onCleanup, untrack } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { apiFetch } from "~/lib/api";
import { unlockAudioContext, getAudioContext } from "~/lib/audio/context";
import { getMasterBus } from "~/lib/audio/masterBus";
import type { StepPattern, StepSequencer } from "~/lib/audio/stepSeq";
import { PolySynth, type SynthPreset } from "~/lib/audio/synth";
import { hasPatternContent, isAudioTrackType, isInstrumentTrackType, type UITrack } from "../types";
import { STUDIO_BAR_PX } from "../lib/regionMath";

type Deps = {
  getSeq: () => StepSequencer | null;
  getSynth: () => PolySynth | null;
  ensureSynth?: (preset: SynthPreset) => void;
  tracks: Accessor<UITrack[]>;
  bpm: Accessor<number>; setBpm: Setter<number>;
  timeSignature: Accessor<[number, number]>;
  metronomeEnabled: Accessor<boolean>;
  playing: Accessor<boolean>; setPlaying: Setter<boolean>;
  elapsed: Accessor<number>; setElapsed: Setter<number>;
  masterVol: Accessor<number>; setMasterVol: Setter<number>;
  playheadPx: Accessor<number>; setPlayheadPx: Setter<number>;
  pattern: Accessor<StepPattern>; setPattern: Setter<StepPattern>;
  loopEnabled: Accessor<boolean>;
  cycleStartPx: Accessor<number>;
  cycleEndPx: Accessor<number>;
};

type PlaybackSynth = { preset: SynthPreset; synth: PolySynth };

export function useTransport(deps: Deps) {
  let audioSources: AudioBufferSourceNode[] = [];
  let metronomeNodes: AudioScheduledSourceNode[] = [];
  let playbackRaf: number | null = null;
  let playbackStartCtxTime = 0;
  let playbackStartTimelineSecs = 0;
  let cycleBoundaryTimer: ReturnType<typeof setTimeout> | null = null;
  let countInTimer: ReturnType<typeof setTimeout> | null = null;
  let playbackRunId = 0;
  let countInRunId = 0;
  let masterGainNode: GainNode | null = null;
  const trackGainNodes = new Map<string, GainNode>();
  const audioBufferCache = new Map<string, AudioBuffer>();
  const audioBufferPromises = new Map<string, Promise<AudioBuffer | null>>();
  const failedSrcCache = new Set<string>();
  const playbackSynths = new Map<string, PlaybackSynth>();

  const quarterNoteSecs = () => 60 / deps.bpm();
  const beatSecs = () => quarterNoteSecs() * (4 / deps.timeSignature()[1]);
  const barSecs = () => deps.timeSignature()[0] * beatSecs();
  const barsToSecs = (bars: number) => bars * barSecs();
  const pxToSecs = (px: number) => barsToSecs(px / STUDIO_BAR_PX);
  const secsToPx = (secs: number) => (secs / barSecs()) * STUDIO_BAR_PX;
  const optionalRemoteUrl = (src: string) =>
    src.includes("optional=") ? src : `${src}${src.includes("?") ? "&" : "?"}optional=1`;

  const anySoloed = () => deps.tracks().some(track => track.solo);
  const isTrackAudible = (track: UITrack) => !track.muted && (!anySoloed() || track.solo);
  const audioTracks = () => deps.tracks().filter(track => isAudioTrackType(track.type));
  const instrumentTracks = () => deps.tracks().filter(track => isInstrumentTrackType(track.type));
  const shouldRunDrumSequencer = () =>
    deps.tracks().some(track => track.type === "drum" && isTrackAudible(track)) &&
    hasPatternContent(deps.pattern());

  const synthPresetForTrack = (track: UITrack): SynthPreset =>
    track.instrumentPreset ?? (track.type === "bass" ? "bass" : track.type === "guitar" ? "guitar" : "piano");

  const playbackSynthForTrack = (track: UITrack) => {
    const preset = synthPresetForTrack(track);
    const existing = playbackSynths.get(track.id);
    if (existing?.preset === preset) return existing.synth;
    existing?.synth.dispose();
    const synth = new PolySynth(preset);
    playbackSynths.set(track.id, { preset, synth });
    return synth;
  };

  const isPlaybackRunActive = (runId: number) => runId === playbackRunId && deps.playing();

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

  const stopScheduledNodes = () => {
    for (const node of [...audioSources, ...metronomeNodes]) {
      try { node.stop(); } catch { /* already ended */ }
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    audioSources = [];
    metronomeNodes = [];
  };

  const stopAudioPlayback = () => {
    playbackRunId++;
    countInRunId++;
    stopScheduledNodes();
    if (playbackRaf !== null) {
      cancelAnimationFrame(playbackRaf);
      playbackRaf = null;
    }
    if (cycleBoundaryTimer) {
      clearTimeout(cycleBoundaryTimer);
      cycleBoundaryTimer = null;
    }
    if (countInTimer) {
      clearTimeout(countInTimer);
      countInTimer = null;
    }
    deps.getSynth()?.allNotesOff();
    playbackSynths.forEach(({ synth }) => synth.allNotesOff());
    trackGainNodes.forEach(node => {
      try { node.disconnect(); } catch { /* already disconnected */ }
    });
    trackGainNodes.clear();
    if (masterGainNode) {
      try { masterGainNode.disconnect(); } catch { /* already disconnected */ }
      masterGainNode = null;
    }
  };

  const fetchAudioBuffer = (src: string): Promise<AudioBuffer | null> => {
    const cached = audioBufferCache.get(src);
    if (cached) return Promise.resolve(cached);
    if (failedSrcCache.has(src)) return Promise.resolve(null);
    const pending = audioBufferPromises.get(src);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const requestSrc = src.startsWith("/api/") ? optionalRemoteUrl(src) : src;
        const response = src.startsWith("/api/") ? await apiFetch(requestSrc) : await fetch(requestSrc);
        if (response.status === 204 || !response.ok) {
          failedSrcCache.add(src);
          return null;
        }
        const buffer = await getAudioContext().decodeAudioData(await response.arrayBuffer());
        audioBufferCache.set(src, buffer);
        return buffer;
      } catch {
        failedSrcCache.add(src);
        return null;
      } finally {
        audioBufferPromises.delete(src);
      }
    })();
    audioBufferPromises.set(src, promise);
    return promise;
  };

  const preloadAudioBuffers = async () => {
    const sources = new Set<string>();
    for (const track of audioTracks()) {
      for (const clip of track.clips ?? []) {
        const src = clip.url || clip.remoteUrl;
        if ((clip.kind === "audio" || clip.kind === "video") && src) sources.add(src);
      }
    }
    await Promise.all([...sources].map(fetchAudioBuffer));
  };

  const scheduleClick = (atTime: number, downbeat: boolean) => {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.setValueAtTime(downbeat ? 1760 : 1180, atTime);
    gain.gain.setValueAtTime(0.0001, Math.max(ctx.currentTime, atTime - 0.002));
    gain.gain.exponentialRampToValueAtTime(downbeat ? 0.34 : 0.2, atTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.045);
    oscillator.connect(gain);
    gain.connect(getMasterBus().input);
    oscillator.start(atTime);
    oscillator.stop(atTime + 0.05);
    metronomeNodes.push(oscillator);
  };

  const scheduleMetronome = (
    timelineStartSecs: number,
    timelineEndSecs: number,
    scheduleAt: number,
  ) => {
    if (!deps.metronomeEnabled()) return;
    const beatDuration = beatSecs();
    const beatsPerBar = deps.timeSignature()[0];
    const firstBeat = Math.ceil((timelineStartSecs - 0.0001) / beatDuration);
    const lastBeat = Math.ceil(timelineEndSecs / beatDuration);
    for (let beatIndex = firstBeat; beatIndex < lastBeat; beatIndex++) {
      const beatTimelineSecs = beatIndex * beatDuration;
      const atTime = scheduleAt + Math.max(0, beatTimelineSecs - timelineStartSecs);
      scheduleClick(atTime, ((beatIndex % beatsPerBar) + beatsPerBar) % beatsPerBar === 0);
    }
  };

  const scheduleMidiPlayback = (
    timelineStartSecs: number,
    segmentEndSecs: number,
    scheduleAt: number,
  ) => {
    for (const track of instrumentTracks()) {
      if (!isTrackAudible(track)) continue;
      const synth = playbackSynthForTrack(track);
      synth.setMasterGainDb(track.volume <= 0.001 ? -60 : 20 * Math.log10(track.volume ?? 1));
      for (const clip of track.clips ?? []) {
        if (clip.kind !== "midi" || !clip.midiNotes?.length) continue;
        const clipStartSecs = barsToSecs(clip.barStart);
        const clipEndSecs = barsToSecs(clip.barStart + clip.bars);
        if (clipEndSecs <= timelineStartSecs || clipStartSecs >= segmentEndSecs) continue;

        for (const note of clip.midiNotes) {
          const noteStartSecs = clipStartSecs + barsToSecs(note.startBars);
          const noteEndSecs = noteStartSecs + barsToSecs(note.durationBars);
          if (noteEndSecs <= timelineStartSecs || noteStartSecs >= segmentEndSecs) continue;
          const audibleStartSecs = Math.max(noteStartSecs, timelineStartSecs);
          const audibleEndSecs = Math.min(noteEndSecs, segmentEndSecs);
          synth.scheduleNote(
            Math.max(0, Math.min(127, Math.round(note.midi))),
            Math.max(0.05, Math.min(1, note.velocity)),
            scheduleAt + (audibleStartSecs - timelineStartSecs),
            audibleEndSecs - audibleStartSecs,
          );
        }
      }
    }
  };

  const arrangementEndPx = () => {
    const audioEnds = audioTracks().flatMap(track =>
      (track.clips ?? []).filter(clip => clip.url || clip.remoteUrl)
        .map(clip => (clip.barStart + clip.bars) * STUDIO_BAR_PX)
    );
    const midiEnds = instrumentTracks().flatMap(track =>
      (track.clips ?? []).filter(clip => clip.kind === "midi")
        .map(clip => (clip.barStart + clip.bars) * STUDIO_BAR_PX)
    );
    const patternBars = (deps.pattern().steps ?? 16) / 16;
    return [...audioEnds, ...midiEnds].length
      ? Math.max(...audioEnds, ...midiEnds)
      : patternBars * STUDIO_BAR_PX;
  };

  const startAudioPlayback = async (requestedStartPx = deps.playheadPx()) => {
    stopAudioPlayback();
    const runId = playbackRunId;
    await preloadAudioBuffers();
    if (!isPlaybackRunActive(runId)) return;

    const ctx = getAudioContext();
    const playbackStartPx = normalizedPlaybackStartPx(requestedStartPx);
    const timelineStartSecs = pxToSecs(playbackStartPx);
    const scheduleAt = ctx.currentTime + 0.05;
    playbackStartCtxTime = scheduleAt;
    playbackStartTimelineSecs = timelineStartSecs;
    deps.setPlayheadPx(playbackStartPx);
    deps.setElapsed(timelineStartSecs);

    const bounds = cycleBounds();
    const endPx = Math.max(arrangementEndPx(), playbackStartPx + STUDIO_BAR_PX);
    const segmentEndSecs = bounds.enabled ? bounds.endSecs : pxToSecs(endPx);

    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = deps.masterVol();
    masterGainNode.connect(getMasterBus().input);

    for (const track of audioTracks()) {
      if (!isTrackAudible(track)) continue;
      const trackGain = ctx.createGain();
      trackGain.gain.value = track.volume ?? 1;
      trackGain.connect(masterGainNode);
      trackGainNodes.set(track.id, trackGain);

      for (const clip of track.clips ?? []) {
        if (clip.kind !== "audio" && clip.kind !== "video") continue;
        const audioSrc = clip.url || clip.remoteUrl;
        const buffer = audioSrc ? audioBufferCache.get(audioSrc) : undefined;
        if (!buffer) continue;
        const clipStartSecs = barsToSecs(clip.barStart);
        const clipEndSecs = clipStartSecs + barsToSecs(clip.bars);
        if (clipEndSecs <= timelineStartSecs || clipStartSecs >= segmentEndSecs) continue;
        const playStartSecs = Math.max(clipStartSecs, timelineStartSecs);
        const playEndSecs = Math.min(clipEndSecs, segmentEndSecs);
        const playableSecs = playEndSecs - playStartSecs;
        if (playableSecs <= 0) continue;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = Math.max(0.25, Math.min(4, clip.playbackRate ?? 1));
        source.connect(trackGain);
        source.start(
          scheduleAt + (playStartSecs - timelineStartSecs),
          barsToSecs(clip.sourceOffsetBars ?? 0) + (playStartSecs - clipStartSecs),
          playableSecs,
        );
        audioSources.push(source);
      }
    }

    scheduleMidiPlayback(timelineStartSecs, segmentEndSecs, scheduleAt);
    scheduleMetronome(timelineStartSecs, segmentEndSecs, scheduleAt);

    const doLoop = () => {
      if (!isPlaybackRunActive(runId)) return;
      deps.setPlayheadPx(bounds.startPx);
      deps.setElapsed(bounds.startSecs);
      void startAudioPlayback(bounds.startPx).then(() => {
        if (shouldRunDrumSequencer()) void deps.getSeq()?.start(bounds.startSecs);
      });
    };

    const tickPlayhead = () => {
      if (!isPlaybackRunActive(runId)) return;
      const elapsedSinceSchedule = Math.max(0, ctx.currentTime - playbackStartCtxTime);
      const currentSecs = playbackStartTimelineSecs + elapsedSinceSchedule;
      const liveBounds = cycleBounds();
      if (liveBounds.enabled && currentSecs >= liveBounds.endSecs) {
        doLoop();
        return;
      }
      deps.setPlayheadPx(secsToPx(currentSecs));
      deps.setElapsed(currentSecs);
      playbackRaf = requestAnimationFrame(tickPlayhead);
    };
    playbackRaf = requestAnimationFrame(tickPlayhead);

    if (bounds.enabled) {
      cycleBoundaryTimer = setTimeout(
        doLoop,
        Math.max(0, (scheduleAt - ctx.currentTime + bounds.endSecs - timelineStartSecs) * 1000),
      );
    }
  };

  const seek = async (requestedPx: number) => {
    const nextPx = normalizedPlaybackStartPx(requestedPx);
    deps.setPlayheadPx(nextPx);
    deps.setElapsed(pxToSecs(nextPx));
    if (!deps.playing()) return;
    deps.getSeq()?.stop();
    await startAudioPlayback(nextPx);
    if (deps.playing() && shouldRunDrumSequencer()) await deps.getSeq()?.start(pxToSecs(nextPx));
  };

  const togglePlay = async () => {
    await unlockAudioContext();
    const seq = deps.getSeq();
    if (deps.playing()) {
      seq?.stop();
      deps.setPlaying(false);
      stopAudioPlayback();
      return;
    }
    deps.setPlaying(true);
    await startAudioPlayback();
    if (!deps.playing()) return;
    if (shouldRunDrumSequencer()) await seq?.start(pxToSecs(deps.playheadPx()));
    else seq?.stop();
  };

  const stopAll = () => {
    deps.getSeq()?.stop();
    deps.setPlaying(false);
    deps.setElapsed(0);
    stopAudioPlayback();
    deps.setPlayheadPx(0);
  };

  const countIn = async (bars = 1): Promise<boolean> => {
    await unlockAudioContext();
    const runId = ++countInRunId;
    if (countInTimer) clearTimeout(countInTimer);
    for (const node of metronomeNodes) {
      try { node.stop(); } catch { /* already ended */ }
    }
    metronomeNodes = [];
    const ctx = getAudioContext();
    const startAt = ctx.currentTime + 0.05;
    const totalBeats = Math.max(1, Math.round(bars)) * deps.timeSignature()[0];
    const duration = totalBeats * beatSecs();
    for (let beat = 0; beat < totalBeats; beat++) {
      scheduleClick(startAt + beat * beatSecs(), beat % deps.timeSignature()[0] === 0);
    }
    return new Promise(resolve => {
      countInTimer = setTimeout(() => {
        countInTimer = null;
        resolve(runId === countInRunId);
      }, Math.max(0, (startAt - ctx.currentTime + duration) * 1000));
    });
  };

  const cancelCountIn = () => {
    countInRunId++;
    if (countInTimer) clearTimeout(countInTimer);
    countInTimer = null;
    for (const node of metronomeNodes) {
      try { node.stop(); } catch { /* already ended */ }
    }
    metronomeNodes = [];
  };

  const updateBpm = (value: number) => {
    const clamped = Math.max(40, Math.min(240, Number.isFinite(value) ? value : 100));
    deps.setBpm(clamped);
    const seq = deps.getSeq();
    if (seq) {
      seq.setBpm(clamped);
      deps.setPattern({ ...seq.getPattern() });
    }
  };

  const setMasterVolume = (value: number) => {
    deps.setMasterVol(value);
    const db = value <= 0.001 ? -60 : 20 * Math.log10(value);
    deps.getSeq()?.setMasterGainDb(db);
    deps.getSynth()?.setMasterGainDb(db);
    if (masterGainNode) {
      masterGainNode.gain.setTargetAtTime(value, getAudioContext().currentTime, 0.01);
    }
  };

  const setTrackVolume = (trackId: string, value: number) => {
    const node = trackGainNodes.get(trackId);
    if (node) node.gain.setTargetAtTime(Math.max(0, value), getAudioContext().currentTime, 0.01);
    const synth = playbackSynths.get(trackId)?.synth;
    if (synth) synth.setMasterGainDb(value <= 0.001 ? -60 : 20 * Math.log10(value));
  };

  onCleanup(() => {
    stopAudioPlayback();
    playbackSynths.forEach(({ synth }) => synth.dispose());
    playbackSynths.clear();
  });

  let lastPlaybackSignature = "";
  createEffect(() => {
    const signature = [
      deps.loopEnabled(),
      deps.cycleStartPx(),
      deps.cycleEndPx(),
      deps.bpm(),
      deps.timeSignature().join("/"),
      deps.metronomeEnabled(),
    ].join("|");
    if (lastPlaybackSignature && deps.playing()) {
      untrack(() => { void seek(deps.playheadPx()); });
    }
    lastPlaybackSignature = signature;
  });

  return {
    togglePlay,
    stopAll,
    seek,
    countIn,
    cancelCountIn,
    updateBpm,
    setMasterVolume,
    stopAudioPlayback,
    setTrackVolume,
  };
}
