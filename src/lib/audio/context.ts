// Singleton AudioContext. Created lazily on first user gesture
// because browsers block AudioContext.start() before user interaction.

import * as Tone from "tone";

let ctx: AudioContext | null = null;
let toneBound = false;

/** Returns the shared AudioContext, creating it on first call. */
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
  }
  return ctx;
}

/** Make sure Tone.js is using the same shared AudioContext. */
export function bindToneToContext(): void {
  if (toneBound) return;
  const c = getAudioContext();
  // setContext accepts a raw AudioContext in Tone v15+
  if ((Tone.getContext() as unknown as { rawContext?: AudioContext }).rawContext !== c) {
    Tone.setContext(c);
  }
  toneBound = true;
}

/** Call from a click/tap handler to unblock playback. Safe to call repeatedly. */
export async function unlockAudioContext(): Promise<void> {
  const c = getAudioContext();
  if (c.state === "suspended") {
    await c.resume();
  }
  bindToneToContext();
  // Tone needs its own start gesture handshake.
  try { await Tone.start(); } catch { /* */ }
}
