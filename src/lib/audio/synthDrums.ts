// Tone.js drum kit. Each voice exposes a `trigger(time, velocity)` method
// that fires a hit at a precise AudioContext time, so the step sequencer
// keeps its tight look-ahead scheduling.

import * as Tone from "tone";
import { bindToneToContext } from "./context";

export type DrumName = "kick" | "snare" | "hat_closed" | "hat_open" | "clap" | "tom_hi" | "tom_lo" | "rimshot";
export const DRUM_NAMES: DrumName[] = ["kick", "snare", "hat_closed", "hat_open", "clap", "tom_hi", "tom_lo", "rimshot"];

export interface DrumVoice {
  trigger(time: number, velocity: number): void;
  dispose(): void;
}

// Math.random() is [0,1]; * 2 - 1 shifts it to [-1,1] so the jitter is centered on zero
const rnd = (range: number) => (Math.random() * 2 - 1) * range;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// humanized velocity: adds ±velRange variation then clamps to 0.05-1 (floor prevents silent ghost hits)
const hVel = (v: number, velRange = 0.06) => clamp(v + rnd(velRange), 0.05, 1);
// shifts a hit forward in time by 0–maxJitterMs; intentionally one-sided (never early) to stay in tempo
const hTime = (t: number, maxJitterMs = 6) => t + Math.random() * (maxJitterMs / 1000);

export class DrumKit {
  voices: Record<DrumName, DrumVoice>;

  constructor(destination: Tone.ToneAudioNode) {
    bindToneToContext();

    // kick
    // pitchDecay = how fast the pitch falls after the initial hit; octaves = how many octaves it drops
    // together they create the characteristic low "thud" — high start frequency diving down fast
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 1.4, attackCurve: "exponential" },
      volume: -2,
    }).connect(destination);

    // snare (noise layer + body)
    const snareHP = new Tone.Filter(1000, "highpass").connect(destination);
    const snareNoise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.13, sustain: 0 },
      volume: -8,
    }).connect(snareHP);
    const snareBody = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
      volume: -12,
    }).connect(destination);

    // hi-hats
    // NoiseSynth + highpass; MetalSynth was less reliable across browsers
    // closed hat cuts at 7 kHz (tighter/more metallic); open hat cuts at 5 kHz to let more body through
    const hatHp = new Tone.Filter(7000, "highpass").connect(destination);
    const hatClosed = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      volume: 2,
    }).connect(hatHp);

    const hatOpenHp = new Tone.Filter(5000, "highpass").connect(destination);
    const hatOpen = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.1, release: 0.3 },
      volume: 0,
    }).connect(hatOpenHp);

    // clap: white noise = sharp crack on the attack; pink noise (softer roll-off) = the airy tail
    // two separate synths let each layer have its own envelope and slight timing offset
    const clapHp = new Tone.Filter(800, "highpass").connect(destination);
    const clap = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      volume: -2,
    }).connect(clapHp);
    const clapTail = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.005, decay: 0.22, sustain: 0 },
      volume: -8,
    }).connect(clapHp);

    // tom hi
    const tomHi = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.3 },
      volume: -8,
    }).connect(destination);

    // tom lo
    const tomLo = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.5 },
      volume: -6,
    }).connect(destination);

    // rimshot
    const rimshotHP = new Tone.Filter(800, "highpass").connect(destination);
    const rimshot = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: -12,
    }).connect(rimshotHP);
    const rimshotBody = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      volume: -14,
    }).connect(destination);

    this.voices = {
      kick: {
        trigger(time, vel) {
          kick.triggerAttackRelease("C1", "8n", time, hVel(vel, 0.04));
        },
        dispose() { kick.dispose(); },
      },
      snare: {
        trigger(time, vel) {
          const v = hVel(vel, 0.07);
          // noise fires first (louder crack); body fires a hair later at 60% volume
          // the independent jitter on each layer mimics the slight desync of wire vs membrane
          snareNoise.triggerAttackRelease("16n", hTime(time, 2), v);
          snareBody.triggerAttackRelease("G2", "16n", hTime(time, 1), v * 0.6);
        },
        dispose() { snareNoise.dispose(); snareBody.dispose(); snareHP.dispose(); },
      },
      hat_closed: {
        trigger(time, vel) {
          hatClosed.triggerAttackRelease("32n", time, hVel(vel, 0.08));
        },
        dispose() { hatClosed.dispose(); hatHp.dispose(); },
      },
      hat_open: {
        trigger(time, vel) {
          hatOpen.triggerAttackRelease("8n", time, hVel(vel, 0.07));
        },
        dispose() { hatOpen.dispose(); hatOpenHp.dispose(); },
      },
      clap: {
        trigger(time, vel) {
          const v = hVel(vel, 0.08);
          // tail fires 0–4 ms late at 60% volume; simulates multiple hands slightly out of sync
          clap.triggerAttackRelease("16n", time, v);
          clapTail.triggerAttackRelease("16n", hTime(time, 4), v * 0.6);
        },
        dispose() { clap.dispose(); clapTail.dispose(); clapHp.dispose(); },
      },
      tom_hi: {
        trigger(time, vel) {
          tomHi.triggerAttackRelease("G3", "8n", time, hVel(vel, 0.05));
        },
        dispose() { tomHi.dispose(); },
      },
      tom_lo: {
        trigger(time, vel) {
          tomLo.triggerAttackRelease("D2", "8n", time, hVel(vel, 0.05));
        },
        dispose() { tomLo.dispose(); },
      },
      rimshot: {
        trigger(time, vel) {
          const v = hVel(vel, 0.08);
          // noise = high crack of the rim; MembraneSynth at A3 = the resonant body thud
          // each fires at a slightly different random offset so they don't fuse into one flat hit
          rimshot.triggerAttackRelease("32n", hTime(time, 5), v);
          rimshotBody.triggerAttackRelease("A3", "32n", hTime(time, 3), v * 0.5);
        },
        dispose() { rimshot.dispose(); rimshotBody.dispose(); rimshotHP.dispose(); },
      },
    };
  }

  dispose(): void {
    for (const v of Object.values(this.voices)) v.dispose();
  }
}
