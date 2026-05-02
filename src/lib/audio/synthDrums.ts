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

/** Returns a random value in [-range, +range]. */
const rnd = (range: number) => (Math.random() * 2 - 1) * range;
/** Clamps a value to [lo, hi]. */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Humanized velocity: adds ±velRange variation then clamps to 0.05–1. */
const hVel = (v: number, velRange = 0.06) => clamp(v + rnd(velRange), 0.05, 1);
/** Tiny timing nudge in seconds — used only for softer hits so the beat stays tight. */
const hTime = (t: number, maxJitterMs = 6) => t + Math.random() * (maxJitterMs / 1000);

export class DrumKit {
  voices: Record<DrumName, DrumVoice>;

  constructor(destination: Tone.ToneAudioNode) {
    bindToneToContext();

    // ── Kick ─────────────────────────────────────────────
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 1.4, attackCurve: "exponential" },
      volume: -2,
    }).connect(destination);

    // ── Snare (noise + body) ─────────────────────────────
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

    // ── Hi-hats ──────────────────────────────────────────
    const hatClosed = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -28,
    }).connect(destination);

    const hatOpen = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.35, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -26,
    }).connect(destination);

    // ── Clap ─────────────────────────────────────────────
    const clapBP = new Tone.Filter({ frequency: 1500, type: "bandpass", Q: 1.2 }).connect(destination);
    const clap = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
      volume: -10,
    }).connect(clapBP);

    // ── Tom Hi ────────────────────────────────────────────
    const tomHi = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.3 },
      volume: -8,
    }).connect(destination);

    // ── Tom Lo ───────────────────────────────────────────
    const tomLo = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.5 },
      volume: -6,
    }).connect(destination);

    // ── Rimshot ──────────────────────────────────────────
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
          snareNoise.triggerAttackRelease("16n", hTime(time, 2), v);
          snareBody.triggerAttackRelease("G2", "16n", hTime(time, 1), v * 0.6);
        },
        dispose() { snareNoise.dispose(); snareBody.dispose(); snareHP.dispose(); },
      },
      hat_closed: {
        trigger(time, vel) {
          hatClosed.triggerAttackRelease("32n", hTime(time, 5), hVel(vel, 0.08));
        },
        dispose() { hatClosed.dispose(); },
      },
      hat_open: {
        trigger(time, vel) {
          hatOpen.triggerAttackRelease("8n", hTime(time, 4), hVel(vel, 0.07));
        },
        dispose() { hatOpen.dispose(); },
      },
      clap: {
        trigger(time, vel) {
          clap.triggerAttackRelease("16n", hTime(time, 6), hVel(vel, 0.09));
        },
        dispose() { clap.dispose(); clapBP.dispose(); },
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
