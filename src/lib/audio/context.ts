// Singleton AudioContext. Created lazily on first user gesture
// because browsers block AudioContext.start() before user interaction.

let ctx: AudioContext | null = null;

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

/** Call from a click/tap handler to unblock playback. Safe to call repeatedly. */
export async function unlockAudioContext(): Promise<void> {
  const c = getAudioContext();
  if (c.state === "suspended") {
    await c.resume();
  }
}
