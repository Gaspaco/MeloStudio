// Singleton AudioContext. Created lazily on first user gesture
// because browsers block AudioContext.start() before user interaction.

import * as Tone from "tone";

let ctx: AudioContext | null = null;
let toneBound = false;

export function getExistingAudioContext(): AudioContext | null {
  return ctx;
}

/**
 * True when the context is live and Tone is bound, so a note can be triggered
 * synchronously without awaiting the unlock path — keeps live playing snappy.
 */
export function isAudioContextReady(): boolean {
  return ctx !== null && ctx.state === "running" && toneBound;
}

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    // Numeric latencyHint requests roughly one 128-sample render quantum at
    // 48 kHz. Browsers may choose a different supported device buffer size.
    ctx = new Ctor({
      latencyHint: 128 / 48000,
      sampleRate: 48000,
    });
    // When the browser automatically resumes the context after an interruption
    // (e.g. the tab returns to foreground on iOS/Chrome, or a phone call
    // ends), re-sync Tone.js so its transport clock stays in step with the
    // AudioContext clock. Without this, Tone.js can silently stop producing
    // audio even though ctx.state is "running".
    ctx.addEventListener("statechange", () => {
      if (ctx?.state === "running") {
        bindToneToContext();
      }
    });
  }
  return ctx;
}

export function bindToneToContext(): void {
  const c = getAudioContext();
  const toneContext = Tone.getContext() as unknown as {
    rawContext?: AudioContext;
    lookAhead: number;
    updateInterval: number;
  };
  // setContext accepts a raw AudioContext in Tone v15+
  if (toneContext.rawContext !== c) {
    Tone.setContext(c);
  }
  const activeToneContext = Tone.getContext() as unknown as { lookAhead: number; updateInterval: number };
  activeToneContext.lookAhead = 0.01;
  activeToneContext.updateInterval = 0.005;
  toneBound = true;
}

export async function unlockAudioContext(): Promise<void> {
  const c = getAudioContext();
  // Handle both "suspended" (Chrome/Firefox autoplay-policy suspension) and
  // "interrupted" (iOS Safari / Chrome hardware interruptions such as tab
  // being backgrounded, laptop lid closed, or system audio taken by another app).
  // TypeScript's lib doesn't yet include "interrupted" in AudioContextState, so
  // we widen to string for the comparison.
  if (c.state === "suspended" || (c.state as string) === "interrupted") {
    try {
      await c.resume();
    } catch { /* interrupted contexts may refuse resume in some browsers */ }
  }
  bindToneToContext();
  try { await Tone.start(); } catch { /* */ }
}
