// The `useTransport` hook orchestrates playback across all audio sub-systems.
// In a DAW, the "Transport" refers to the global play/pause/record controls and timeline playhead.
// This hook bridges the Web Audio API, Tone.js (for drums), the PolySynth (for MIDI), 
// and raw AudioBuffers (for audio clips). When the user clicks play, it schedules 
// all upcoming clips to play at precisely the right moment on the audio context thread,
// and starts a visual `requestAnimationFrame` loop to animate the playhead smoothly.
import { onCleanup } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { unlockAudioContext, getAudioContext } from "~/lib/audio/context";
import type { StepPattern, StepSequencer } from "~/lib/audio/stepSeq";
import type { PolySynth } from "~/lib/audio/synth";
import type { UITrack } from "../types";

type Deps = {
  getSeq: () => StepSequencer | null;
  getSynth: () => PolySynth | null;
  tracks: Accessor<UITrack[]>;
  bpm: Accessor<number>; setBpm: Setter<number>;
  playing: Accessor<boolean>; setPlaying: Setter<boolean>;
  elapsed: Accessor<number>; setElapsed: Setter<number>;
  masterVol: Accessor<number>; setMasterVol: Setter<number>;
  playheadPx: Accessor<number>; setPlayheadPx: Setter<number>;
  pattern: Accessor<StepPattern>; setPattern: Setter<StepPattern>;
};

export function useTransport(deps: Deps) {
  let audioSources: AudioBufferSourceNode[] = [];
  let playbackRaf: number | null = null;
  let playbackStartCtxTime = 0;
  let playbackStartTimelineSecs = 0;
  const audioBufferCache = new Map<string, AudioBuffer>();
  let masterGainNode: GainNode | null = null;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;

  const barsToSecs = (bars: number) => bars * 4 * (60 / deps.bpm());
  const pxToSecs   = (px: number)   => (px / 80) * 4 * (60 / deps.bpm());
  const secsToPx   = (secs: number) => secs * (deps.bpm() / 60) * (80 / 4);

  const stopAudioPlayback = () => {
    for (const src of audioSources) { try { src.stop(); } catch { /* already ended */ } }
    audioSources = [];
    if (playbackRaf) { cancelAnimationFrame(playbackRaf); playbackRaf = null; }
    if (masterGainNode) { try { masterGainNode.disconnect(); } catch { /* */ } masterGainNode = null; }
  };

  const startAudioPlayback = async () => {
    stopAudioPlayback();
    const ctx = getAudioContext();
    const timelineStartSecs = pxToSecs(deps.playheadPx());
    playbackStartCtxTime    = ctx.currentTime;
    playbackStartTimelineSecs = timelineStartSecs;

    const tickPlayhead = () => {
      const el = getAudioContext().currentTime - playbackStartCtxTime;
      deps.setPlayheadPx(secsToPx(playbackStartTimelineSecs + el));
      playbackRaf = requestAnimationFrame(tickPlayhead);
    };
    playbackRaf = requestAnimationFrame(tickPlayhead);

    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = deps.masterVol();
    masterGainNode.connect(ctx.destination);

    for (const track of deps.tracks()) {
      for (const clip of track.clips ?? []) {
        if (clip.kind === "midi" || !clip.url) continue;
        let buffer = audioBufferCache.get(clip.url);
        if (!buffer) {
          try {
            const ab = await fetch(clip.url).then(r => r.arrayBuffer());
            buffer = await ctx.decodeAudioData(ab);
            audioBufferCache.set(clip.url, buffer);
          } catch { continue; }
        }
        const clipStartSecs = barsToSecs(clip.barStart);
        const clipEndSecs   = clipStartSecs + barsToSecs(clip.bars);
        if (clipEndSecs <= timelineStartSecs) continue;
        const offsetInClip = Math.max(0, timelineStartSecs - clipStartSecs);
        const delayFromNow = Math.max(0, clipStartSecs - timelineStartSecs);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(masterGainNode!);
        src.start(ctx.currentTime + delayFromNow, offsetInClip);
        audioSources.push(src);
      }
    }
  };

  const togglePlay = async () => {
    const seq = deps.getSeq();
    if (!seq) return;
    await unlockAudioContext();
    if (deps.playing()) {
      seq.stop();
      deps.setPlaying(false);
      if (elapsedTimer) clearInterval(elapsedTimer);
      elapsedTimer = null;
      stopAudioPlayback();
    } else {
      await seq.start();
      deps.setPlaying(true);
      startTime = performance.now();
      elapsedTimer = setInterval(() => deps.setElapsed((performance.now() - startTime) / 1000), 50);
      await startAudioPlayback();
    }
  };

  const stopAll = () => {
    const seq = deps.getSeq();
    if (!seq) return;
    seq.stop();
    deps.setPlaying(false);
    deps.setElapsed(0);
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = null;
    stopAudioPlayback();
    deps.setPlayheadPx(0);
  };

  const updateBpm = (v: number) => {
    const seq = deps.getSeq();
    const clamped = Math.max(40, Math.min(240, v || 100));
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

  return { togglePlay, stopAll, updateBpm, setMasterVolume, stopAudioPlayback };
}
