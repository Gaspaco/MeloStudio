// `useDrum` links the visual Studio Drum Machine panel to the actual `StepSequencer`
// Web Audio engine layer. When a user clicks a sequencer button on screen, this hook:
// 1. Modifies the internal integer array backing the drum pattern sequence.
// 2. Plays a live preview "hit" of the drum so the user hears what they just wrote.
// 3. Syncs the modified state array back up to SolidJS via `setPattern()`, forcing a re-render.
import type { Accessor, Setter } from "solid-js";
import type { StepPattern, StepSequencer } from "~/lib/audio/stepSeq";

type Deps = {
  getSeq: () => StepSequencer | null;
  pattern: Accessor<StepPattern>; setPattern: Setter<StepPattern>;
  drumSwing: Accessor<number>; setDrumSwing: Setter<number>;
  drumSteps: Accessor<number>; setDrumSteps: Setter<number>;
};

export function useDrum(deps: Deps) {
  const sync = () => {
    const seq = deps.getSeq();
    if (!seq) return;
    const p = seq.getPattern();
    deps.setPattern({ ...p, rows: p.rows.map(r => ({ ...r, velocities: [...r.velocities] })) });
  };

  const toggleStep = (rowIdx: number, stepIdx: number) => {
    const seq = deps.getSeq();
    if (!seq) return;
    seq.toggleStep(rowIdx, stepIdx);
    const p = seq.getPattern();
    const row = p.rows[rowIdx];
    if (row && (row.velocities[stepIdx] ?? 0) > 0) void seq.previewDrum(rowIdx);
    deps.setPattern({ ...p, rows: p.rows.map(r => ({ ...r, velocities: [...r.velocities] })) });
  };

  const clearPattern = () => {
    const seq = deps.getSeq();
    if (!seq) return;
    seq.getPattern().rows.forEach((_, i) => seq.clearRow(i));
    sync();
  };

  const cycleStepVelocity = (rowIdx: number, stepIdx: number) => {
    const seq = deps.getSeq();
    if (!seq) return;
    const row = seq.getPattern().rows[rowIdx];
    if (!row) return;
    const cur = row.velocities[stepIdx] ?? 0;
    // Velocity cycle: off → full (1.0) → medium (0.6) → ghost (0.3) → off — mirrors typical hardware drum pad right-click behavior
    const next = cur <= 0 ? 1.0 : cur >= 0.9 ? 0.6 : cur >= 0.5 ? 0.3 : 0;
    seq.setStepVelocity(rowIdx, stepIdx, next);
    sync();
  };

  const toggleRowMute = (rowIdx: number) => {
    const seq = deps.getSeq();
    if (!seq) return;
    const row = seq.getPattern().rows[rowIdx];
    if (!row) return;
    seq.setRowMuted(rowIdx, !row.muted);
    const p = seq.getPattern();
    deps.setPattern({ ...p, rows: p.rows.map(r => ({ ...r })) });
  };

  const updateRowGain = (rowIdx: number, db: number) => {
    const seq = deps.getSeq();
    if (!seq) return;
    seq.setRowGainDb(rowIdx, db);
    const p = seq.getPattern();
    deps.setPattern({ ...p, rows: p.rows.map(r => ({ ...r })) });
  };

  const updateSwing = (amount: number) => {
    deps.setDrumSwing(amount);
    deps.getSeq()?.setSwing(amount);
  };

  const updateDrumSteps = (steps: number) => {
    const seq = deps.getSeq();
    if (!seq) return;
    seq.setSteps(steps);
    deps.setDrumSteps(steps);
    sync();
  };

  return { toggleStep, clearPattern, cycleStepVelocity, toggleRowMute, updateRowGain, updateSwing, updateDrumSteps };
}
