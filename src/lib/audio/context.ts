// Singleton AudioContext. Created lazily on first user gesture
// because browsers block AudioContext.start() before user interaction.

import * as Tone from "tone";

let ctx: AudioContext | null = null;
let toneBound = false;

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
  if (c.state === "suspended") {
    await c.resume();
  }
  bindToneToContext();
  try { await Tone.start(); } catch { /* */ }
}
