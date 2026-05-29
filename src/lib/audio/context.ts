// Singleton AudioContext. Created lazily on first user gesture
// because browsers block AudioContext.start() before user interaction.

import * as Tone from "tone";

let ctx: AudioContext | null = null;
let toneBound = false;

export function getExistingAudioContext(): AudioContext | null {
  return ctx;
}

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new Ctor({
      latencyHint: "interactive",
      sampleRate: 48000,
    });
    // When the browser automatically resumes the context after an interruption
    // (e.g. the tab returns to foreground on iOS/Chrome 136+, or a phone call
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
  if (toneBound) return;
  const c = getAudioContext();
  // setContext accepts a raw AudioContext in Tone v15+
  if ((Tone.getContext() as unknown as { rawContext?: AudioContext }).rawContext !== c) {
    Tone.setContext(c);
  }
  toneBound = true;
}

export async function unlockAudioContext(): Promise<void> {
  const c = getAudioContext();
  // Handle both "suspended" (Chrome/Firefox autoplay-policy suspension) and
  // "interrupted" (iOS Safari / Chrome 136+ hardware interruptions such as tab
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
