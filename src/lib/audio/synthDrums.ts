// Tone.js drum kit. Each voice exposes a `trigger(time, velocity)` method
// that fires a hit at a precise AudioContext time, so the step sequencer
// keeps its tight look-ahead scheduling.

import * as Tone from "tone";
import { bindToneToContext } from "./context";

export type DrumName = "kick" | "snare" | "hat_closed" | "hat_open" | "clap";
export const DRUM_NAMES: DrumName[] = ["kick", "snare", "hat_closed", "hat_open", "clap"];

export interface DrumVoice {
  trigger(time: number, velocity: number): void;
  dispose(): void;
}

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

    this.voices = {
      kick: {
        trigger(time, vel) {
          kick.triggerAttackRelease("C1", "8n", time, vel);
        },
        dispose() { kick.dispose(); },
      },
      snare: {
        trigger(time, vel) {
          snareNoise.triggerAttackRelease("16n", time, vel);
          snareBody.triggerAttackRelease("G2", "16n", time, vel * 0.6);
        },
        dispose() { snareNoise.dispose(); snareBody.dispose(); snareHP.dispose(); },
      },
      hat_closed: {
        trigger(time, vel) {
          hatClosed.triggerAttackRelease("32n", time, vel);
        },
        dispose() { hatClosed.dispose(); },
      },
      hat_open: {
        trigger(time, vel) {
          hatOpen.triggerAttackRelease("8n", time, vel);
        },
        dispose() { hatOpen.dispose(); },
      },
      clap: {
        trigger(time, vel) {
          clap.triggerAttackRelease("16n", time, vel);
        },
        dispose() { clap.dispose(); clapBP.dispose(); },
      },
    };
  }

  dispose(): void {
    for (const v of Object.values(this.voices)) v.dispose();
  }
}
