// Step sequencer with look-ahead scheduling.
// Loops a 16-step (configurable) pattern in sync with AudioContext.currentTime.

import { getAudioContext } from "./context";
import { getDrumKit, type DrumName } from "./synthDrums";

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
    { drum: "kick",       velocities: Array(16).fill(0), gainDb: 0,  muted: false },
    { drum: "snare",      velocities: Array(16).fill(0), gainDb: -2, muted: false },
    { drum: "hat_closed", velocities: Array(16).fill(0), gainDb: -8, muted: false },
    { drum: "clap",       velocities: Array(16).fill(0), gainDb: -3, muted: false },
  ],
});

const dbToGain = (db: number) => Math.pow(10, db / 20);

export class StepSequencer {
  private kit: Record<DrumName, AudioBuffer> | null = null;
  private pattern: StepPattern;
  private masterGain: GainNode;

  private playing = false;
  private startCtxTime = 0;
  private nextStep = 0;        // next step to schedule
  private timer: ReturnType<typeof setInterval> | null = null;

  /** UI tick callback: receives the *currently audible* step index. */
  onStep: ((stepIndex: number) => void) | null = null;

  constructor(initial?: StepPattern) {
    this.pattern = initial ?? DEFAULT_PATTERN();
    const ctx = getAudioContext();
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(ctx.destination);
  }

  setPattern(p: StepPattern): void { this.pattern = p; }
  getPattern(): StepPattern { return this.pattern; }
  setBpm(bpm: number): void { this.pattern.bpm = Math.max(40, Math.min(240, bpm)); }
  setMasterGainDb(db: number): void {
    const ctx = getAudioContext();
    this.masterGain.gain.setTargetAtTime(dbToGain(db), ctx.currentTime, 0.01);
  }

  toggleStep(rowIdx: number, stepIdx: number): void {
    const row = this.pattern.rows[rowIdx];
    if (!row) return;
    row.velocities[stepIdx] = row.velocities[stepIdx] > 0 ? 0 : 1;
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

  async start(): Promise<void> {
    if (this.playing) return;
    if (!this.kit) this.kit = await getDrumKit();
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    this.playing = true;
    this.startCtxTime = ctx.currentTime + 0.05; // small delay so first step isn't clipped
    this.nextStep = 0;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop(): void {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.onStep?.(-1);
  }

  // ─── private ─────────────────────────────────────────────────────────────

  private get stepDur(): number {
    // 16 steps per 4 beats → 1 step = 1/16 note
    return 60 / this.pattern.bpm / 4;
  }

  private tick(): void {
    if (!this.playing || !this.kit) return;
    const ctx = getAudioContext();
    const lookAhead = 0.1; // 100ms
    const horizon = ctx.currentTime + lookAhead;

    while (true) {
      const stepCtxTime =
        this.startCtxTime + this.nextStep * this.stepDur;
      if (stepCtxTime > horizon) break;
      this.scheduleStep(this.nextStep % this.pattern.steps, stepCtxTime);
      this.nextStep++;
    }

    // Update UI cursor to the step that's *currently* sounding.
    const elapsed = ctx.currentTime - this.startCtxTime;
    if (elapsed >= 0) {
      const cur = Math.floor(elapsed / this.stepDur) % this.pattern.steps;
      this.onStep?.(cur);
    }
  }

  private scheduleStep(stepIdx: number, atTime: number): void {
    if (!this.kit) return;
    const ctx = getAudioContext();
    for (const row of this.pattern.rows) {
      if (row.muted) continue;
      const v = row.velocities[stepIdx] ?? 0;
      if (v <= 0) continue;
      const buf = this.kit[row.drum];
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = v * dbToGain(row.gainDb);
      src.connect(g).connect(this.masterGain);
      src.start(atTime);
      src.onended = () => {
        try { src.disconnect(); g.disconnect(); } catch { /* */ }
      };
    }
  }
}
