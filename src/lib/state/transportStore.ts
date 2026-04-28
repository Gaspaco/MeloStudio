// Ephemeral playback state. Never persisted to Neon.

import { createSignal } from "solid-js";

export const [isPlaying, setIsPlaying] = createSignal(false);

/** Engine writes this ~60Hz; UI reads it for the playhead cursor. */
export const [playheadSec, setPlayheadSec] = createSignal(0);

/** True while preloading assets for a freshly-opened project. */
export const [isLoading, setIsLoading] = createSignal(false);

/** Optional UI message for the loader (e.g. "Loading 12 samples…"). */
export const [loadingMessage, setLoadingMessage] = createSignal<string | null>(null);
