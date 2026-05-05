// Ephemeral playback state. Never persisted to Neon.

import { createSignal } from "solid-js";

export const [isPlaying, setIsPlaying] = createSignal(false);

// engine writes this ~60fps; UI reads it for the playhead cursor
export const [playheadSec, setPlayheadSec] = createSignal(0);

// true while preloading assets for a freshly-opened project
export const [isLoading, setIsLoading] = createSignal(false);

export const [loadingMessage, setLoadingMessage] = createSignal<string | null>(null);
