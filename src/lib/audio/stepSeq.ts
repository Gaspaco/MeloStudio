// Step sequencer powered by Tone.Transport + Tone.Sequence.
//
// Why this matters for UI smoothness:
// - Tone's clock ticks inside an internal Web Worker, so we no longer run
//   a setInterval on the main thread.
// - Audio scheduling happens on the audio thread (Web Audio).
// - UI cursor updates are pushed through Tone.Draw, which lines them up
//   with requestAnimationFrame so they never block paint.

import * as Tone from "tone";
import { bindToneToContext } from "./context";
import { DrumKit, type DrumName, DRUM_NAMES } from "./synthDrums";

/**
 * Sanitize a saved pattern: deduplicate rows by drum name (keep first),
 * filter out unknown drum types, and ensure each row has the right number
 * of velocity slots. Call this before applying a loaded pattern.
 */
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
  /** length === pattern.steps. 0 = off, 1 = max velocity. */
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

  /** UI tick callback: receives the *currently audible* step index. */
  onStep: ((stepIndex: number) => void) | null = null;

  constructor(initial?: StepPattern) {
    this.pattern = initial ?? DEFAULT_PATTERN();
    bindToneToContext();
    this.masterGain = new Tone.Gain(0.8).toDestination();
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
    row.velocities[stepIdx] = row.velocities[stepIdx] > 0 ? 0 : 1;
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

  /** Instantly trigger a single drum voice for UI preview (e.g. on cell click). */
  async previewDrum(rowIdx: number): Promise<void> {
    try { await Tone.start(); } catch { /* */ }
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
    try { await Tone.start(); } catch { /* */ }

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

  // ─── private ─────────────────────────────────────────────────────────────

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
    // Drive the UI cursor through Tone.Draw → requestAnimationFrame.
    // This guarantees we never repaint while the audio thread is mid-tick.
    Tone.getDraw().schedule(() => this.onStep?.(stepIdx), atTime);
  }

  dispose(): void {
    this.stop();
    this.kit?.dispose();
    this.kit = null;
    this.masterGain.dispose();
  }
}
