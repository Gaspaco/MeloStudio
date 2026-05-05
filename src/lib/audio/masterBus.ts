// Master bus processing chain — all audio routes through here before reaching
// the speakers. When "enhanced" mode is on, the signal passes through:
//   Compressor (glue) → Low shelf (warmth) → Presence peak → High shelf (air)
//   → Limiter (ceiling) → Output boost → ctx.destination
// In bypass mode, audio goes directly to ctx.destination with no processing.

import { getAudioContext, bindToneToContext } from "./context";

export interface MasterBus {
  input: GainNode;
  setEnhanced(enabled: boolean): void;
}

let _bus: MasterBus | null = null;

export function getMasterBus(): MasterBus {
  if (_bus) return _bus;
  bindToneToContext();
  const ctx = getAudioContext();

  // Single entry point — everything connects here
  const input = ctx.createGain();
  input.gain.value = 1;

  // ── Bypass path ──────────────────────────────────────────────────────────
  // When bypass=1 the signal skips all processing (flat, unprocessed).
  const bypassGain = ctx.createGain();
  bypassGain.gain.value = 0;
  bypassGain.connect(ctx.destination);

  // ── Processing path ───────────────────────────────────────────────────────
  // When processGain=1 the signal flows through the full mastering chain.
  const processGain = ctx.createGain();
  processGain.gain.value = 1;

  // 1. Glue compressor — noticeably tightens and pumps the mix
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22;   // engage early so it's always working
  comp.knee.value      = 6;
  comp.ratio.value     = 4;     // 4:1 — clearly audible squeeze
  comp.attack.value    = 0.003;
  comp.release.value   = 0.12;

  // 2. Low shelf — strong bass warmth / body
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type            = "lowshelf";
  lowShelf.frequency.value = 120;
  lowShelf.gain.value      = 5;   // +5 dB below 120 Hz — clearly felt

  // 3. Presence peak — cuts through and adds vocal/instrument clarity
  const presence = ctx.createBiquadFilter();
  presence.type            = "peaking";
  presence.frequency.value = 3500;
  presence.Q.value         = 1.2;
  presence.gain.value      = 4;   // +4 dB at 3.5 kHz — noticeably brighter

  // 4. High shelf — sparkle and air on top
  const highShelf = ctx.createBiquadFilter();
  highShelf.type            = "highshelf";
  highShelf.frequency.value = 8000;
  highShelf.gain.value      = 4;   // +4 dB above 8 kHz — obvious shimmer

  // 5. Hard limiter — brick-wall ceiling, allows output boost without clipping
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value      = 0;
  limiter.ratio.value     = 20;
  limiter.attack.value    = 0.001;
  limiter.release.value   = 0.05;

  // 6. Output boost — push overall loudness so Enhanced is clearly louder
  const outputBoost = ctx.createGain();
  outputBoost.gain.value = 1.6; // ≈ +4 dB — immediately obvious volume jump

  // Wire the chain
  input.connect(bypassGain);
  input.connect(processGain);
  processGain.connect(comp);
  comp.connect(lowShelf);
  lowShelf.connect(presence);
  presence.connect(highShelf);
  highShelf.connect(limiter);
  limiter.connect(outputBoost);
  outputBoost.connect(ctx.destination);

  _bus = {
    input,
    setEnhanced(enabled: boolean) {
      const now = ctx.currentTime;
      bypassGain.gain.setTargetAtTime(enabled ? 0 : 1, now, 0.015);
      processGain.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.015);
    },
  };

  return _bus;
}

export function resetMasterBus(): void {
  _bus = null;
}
