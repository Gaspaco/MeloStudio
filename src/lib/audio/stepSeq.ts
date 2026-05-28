// Step sequencer essentially powered by:
// 1. Tone.Transport - a master clock that organizes musical timing (BPM, Bars, Beats, Sixteenths).
// 2. Tone.Sequence - a tool to fire a specific callback sequentially over an array of steps.
//
// Why this architecture is crucial for a smooth Digital Audio Workstation (DAW):
// - Tone's clock internally uses Web Workers, meaning it ticks completely independently 
//   of the main Javascript thread. If the UI freezes for 50ms, audio still plays on rhythm.
// - Callbacks triggered by Tone are pre-scheduled in the exact Web Audio context time.
// - Tone.Draw coordinates visual UI updates (like playhead sweeping) to paint 
//   exactly when the scheduled note hits the speaker, removing visual lag.

import * as Tone from "tone";
import { bindToneToContext, unlockAudioContext } from "./context";
import { getMasterBus } from "./masterBus";
import { DrumKit, type DrumName, DRUM_NAMES } from "./synthDrums";

// Sanitizes a loaded drum pattern so it doesn't break the sequencer.
// If the loaded JSON is corrupt or from an older version, this fixes it:
// 1. Drops unrecognized drum names.
// 2. Deduplicates rows with the same drum name.
// 3. Fills missing array velocity slots with zeros (so the sequencer doesn't crash).
// 4. Guarantees that ALL canonical drums in `DRUM_NAMES` have an exact row in the array.
export function sanitizePattern(p: StepPattern): StepPattern {
  const seen = new Set<string>();
  const rows = (p.rows ?? []).filter(r => {
    if (!DRUM_NAMES.includes(r.drum as DrumName)) return false;
    if (seen.has(r.drum)) return false;
    seen.add(r.drum);
    return true;
  }).map(r => ({
    ...r,
    velocities: Array.from({ length: p.steps ?? 16 }, (_, i) => r.velocities[i] ?? 0),
  }));
  // Ensure all canonical drums are present (add empty rows for missing ones)
  for (const drum of DRUM_NAMES) {
    if (!seen.has(drum)) {
      rows.push({ drum, velocities: Array(p.steps ?? 16).fill(0), gainDb: 0, muted: false });
    }
  }
  return { ...p, steps: p.steps ?? 16, rows };
}

export interface StepRow {
  drum: DrumName;
  // length === pattern.steps. 0 = off, 1 = max velocity
  velocities: number[];
  gainDb: number;
  muted: boolean;
}

export interface StepPattern {
  steps: number;        // 16
  bpm: number;
  rows: StepRow[];
}

export const DEFAULT_PATTERN = (): StepPattern => ({
  steps: 16,
  bpm: 100,
  rows: [
    { drum: "kick",       velocities: Array(16).fill(0), gainDb: 0,   muted: false },
    { drum: "snare",      velocities: Array(16).fill(0), gainDb: -2,  muted: false },
    { drum: "hat_closed", velocities: Array(16).fill(0), gainDb: -8,  muted: false },
    { drum: "hat_open",   velocities: Array(16).fill(0), gainDb: -10, muted: false },
    { drum: "clap",       velocities: Array(16).fill(0), gainDb: -3,  muted: false },
    { drum: "tom_hi",     velocities: Array(16).fill(0), gainDb: -5,  muted: false },
    { drum: "tom_lo",     velocities: Array(16).fill(0), gainDb: -4,  muted: false },
    { drum: "rimshot",    velocities: Array(16).fill(0), gainDb: -6,  muted: false },
  ],
});

const dbToGain = (db: number) => Math.pow(10, db / 20);

export class StepSequencer {
  private kit: DrumKit | null = null;
  private pattern: StepPattern;
  private masterGain: Tone.Gain;
  private sequence: Tone.Sequence<number> | null = null;

  private playing = false;

  // UI tick callback: receives the currently audible step index
  onStep: ((stepIndex: number) => void) | null = null;

  constructor(initial?: StepPattern) {
    this.pattern = initial ?? DEFAULT_PATTERN();
    bindToneToContext();
    this.masterGain = new Tone.Gain(0.8);
    this.masterGain.connect(getMasterBus().input);
    Tone.getTransport().bpm.value = this.pattern.bpm;
  }

  setPattern(p: StepPattern): void {
    this.pattern = p;
    Tone.getTransport().bpm.value = p.bpm;
    if (this.sequence) this.rebuildSequence();
  }
  getPattern(): StepPattern { return this.pattern; }
  setBpm(bpm: number): void {
    this.pattern.bpm = Math.max(40, Math.min(240, bpm));
    Tone.getTransport().bpm.rampTo(this.pattern.bpm, 0.05);
  }
  setMasterGainDb(db: number): void {
    this.masterGain.gain.rampTo(dbToGain(db), 0.01);
  }

  toggleStep(rowIdx: number, stepIdx: number): void {
    const row = this.pattern.rows[rowIdx];
    if (!row) return;
    const velocity = row.velocities[stepIdx];
    if (velocity !== undefined) {
      row.velocities[stepIdx] = velocity > 0 ? 0 : 1;
    }
  }
  setStepVelocity(rowIdx: number, stepIdx: number, velocity: number): void {
    const row = this.pattern.rows[rowIdx];
    if (!row) return;
    row.velocities[stepIdx] = Math.max(0, Math.min(1, velocity));
  }
  setRowMuted(rowIdx: number, muted: boolean): void {
    const r = this.pattern.rows[rowIdx];
    if (r) r.muted = muted;
  }
  setRowGainDb(rowIdx: number, db: number): void {
    const r = this.pattern.rows[rowIdx];
    if (r) r.gainDb = db;
  }
  clearRow(rowIdx: number): void {
    const r = this.pattern.rows[rowIdx];
    if (r) r.velocities = Array(this.pattern.steps).fill(0);
  }
  setSwing(amount: number): void {
    const t = Tone.getTransport();
    t.swing = Math.max(0, Math.min(1, amount));
    t.swingSubdivision = "16n";
  }
  setSteps(n: number): void {
    if (n !== 16 && n !== 32) return;
    this.pattern.steps = n;
    for (const row of this.pattern.rows) {
      if (row.velocities.length < n) {
        row.velocities = [...row.velocities, ...Array(n - row.velocities.length).fill(0)];
      } else {
        row.velocities = row.velocities.slice(0, n);
      }
    }
    if (this.playing) this.rebuildSequence();
  }

  // trigger a single drum voice immediately — for UI preview on cell click
  async previewDrum(rowIdx: number): Promise<void> {
    try { await unlockAudioContext(); } catch { /* */ }
    if (!this.kit) this.kit = new DrumKit(this.masterGain);
    const row = this.pattern.rows[rowIdx];
    if (!row || row.muted) return;
    const voice = this.kit.voices[row.drum as DrumName];
    if (!voice) return;
    const vel = Math.min(1, Math.max(0.15, dbToGain(row.gainDb)));
    voice.trigger(Tone.now(), vel);
  }

  async start(): Promise<void> {
    if (this.playing) return;
    if (!this.kit) this.kit = new DrumKit(this.masterGain);
    try { await unlockAudioContext(); } catch { /* */ }

    this.rebuildSequence();
    Tone.getTransport().start("+0.05");
    this.playing = true;
  }

  stop(): void {
    if (!this.playing) return;
    Tone.getTransport().stop();
    this.sequence?.stop();
    this.sequence?.dispose();
    this.sequence = null;
    this.playing = false;
    // Clear the UI cursor on the next animation frame so it never collides
    // with paint work on the calling tick.
    Tone.getDraw().schedule(() => this.onStep?.(-1), Tone.now());
  }

  private rebuildSequence(): void {
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = null;
    }
    const indices = Array.from({ length: this.pattern.steps }, (_, i) => i);
    this.sequence = new Tone.Sequence<number>(
      (time, stepIdx) => this.scheduleStep(stepIdx, time),
      indices,
      "16n",
    );
    this.sequence.loop = true;
    this.sequence.start(0);
  }

  private scheduleStep(stepIdx: number, atTime: number): void {
    if (!this.kit) return;
    for (const row of this.pattern.rows) {
      if (row.muted) continue;
      const v = row.velocities[stepIdx] ?? 0;
      if (v <= 0) continue;
      const voice = this.kit.voices[row.drum];
      if (!voice) continue;
      const vel = Math.min(1, Math.max(0, v * dbToGain(row.gainDb)));
      voice.trigger(atTime, vel);
    }
    // Tone.Draw schedules the cursor update on the next rAF after atTime,
    // so the UI never repaints while the audio thread is mid-tick.
    Tone.getDraw().schedule(() => this.onStep?.(stepIdx), atTime);
  }

  dispose(): void {
    this.stop();
    this.kit?.dispose();
    this.kit = null;
    this.masterGain.dispose();
  }
}
