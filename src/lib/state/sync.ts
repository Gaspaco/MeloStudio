// Bridges projectStore + transportStore → engine (AudioGraph + Scheduler).
// All UI-driven changes flow through Solid effects so we get fine-grained reactivity:
// only the slice that changed re-runs.

import { createEffect, createRoot, on, onCleanup } from "solid-js";
import { project } from "./projectStore";
import {
  isPlaying,
  setIsPlaying,
  setPlayheadSec,
  setIsLoading,
  setLoadingMessage,
} from "./transportStore";
import { AudioGraph } from "~/lib/audio/graph";
import { Scheduler } from "~/lib/audio/scheduler";
import { AssetManager } from "~/lib/audio/assetManager";
import { getAudioContext, unlockAudioContext } from "~/lib/audio/context";
import { signedUrlResolver, publicPrefixResolver } from "~/lib/storage/r2";

export interface EngineHandles {
  graph: AudioGraph;
  scheduler: Scheduler;
  assets: AssetManager;
  /** Disposes effects and stops audio. Call on route unmount. */
  dispose: () => void;
}

export interface CreateEngineOptions {
  /** When set, uses the public-prefix resolver (dev/CDN). */
  publicAudioPrefix?: string;
  /** Endpoint that mints signed URLs in production. */
  signEndpoint?: string;
  maxMemoryBytes?: number;
}

/** Initialize the engine and wire reactive bridges to the project store.
 *  Call once when the studio page mounts; call dispose() on unmount. */
export function createEngine(opts: CreateEngineOptions = {}): EngineHandles {
  const ctx = getAudioContext();
  const graph = new AudioGraph(ctx);
  const resolveUrl = opts.publicAudioPrefix
    ? publicPrefixResolver(opts.publicAudioPrefix)
    : signedUrlResolver(opts.signEndpoint ?? "/api/asset/sign");
  const assets = new AssetManager({
    resolveUrl,
    maxMemoryBytes: opts.maxMemoryBytes,
  });
  const scheduler = new Scheduler(graph, assets);

  // Engine → store: playhead readout. Throttle to ~60fps for the UI.
  let lastPaint = 0;
  scheduler.onTick = (sec) => {
    const now = performance.now();
    if (now - lastPaint > 16) {
      lastPaint = now;
      setPlayheadSec(sec);
    }
  };

  const dispose = createRoot((disposeRoot) => {
    // ── Master gain ──────────────────────────────────────────────────────
    createEffect(
      on(
        () => project.master,
        (m) => graph.setMaster(m),
      ),
    );

    // ── Per-track reactive sync ──────────────────────────────────────────
    // We re-evaluate on track structural changes (id list / count) and on each
    // track's own gainDb/pan/mute/solo. Solid's fine-grained reactivity means
    // moving track A's slider doesn't fire track B's effect.
    createEffect(() => {
      const anySoloed = project.tracks.some((t) => t.soloed);
      // Drop any nodes for tracks no longer present.
      // Cheap way: reading project.tracks tracks structural changes.
      const liveIds = new Set(project.tracks.map((t) => t.id));
      // We can't enumerate graph internals from outside, but upsert is idempotent
      // and removeTrack on next refactor will be invoked from removeTrack helper.
      for (const t of project.tracks) {
        graph.upsertTrack(t, anySoloed);
      }
      void liveIds; // tracked for debugger / future eviction hook
    });

    // ── Project → scheduler ──────────────────────────────────────────────
    createEffect(
      on(
        () => project.id,
        (id) => {
          if (!id) return;
          scheduler.setProject(project);
        },
      ),
    );

    onCleanup(() => {
      scheduler.stop();
      graph.destroy();
      disposeRoot();
    });

    return disposeRoot;
  });

  return { graph, scheduler, assets, dispose };
}

// ─── Transport actions (called from Play/Stop buttons) ──────────────────────

/** Start playback from the current playhead. Unlocks audio if needed. */
export async function transportPlay(scheduler: Scheduler): Promise<void> {
  await unlockAudioContext();
  setIsLoading(true);
  setLoadingMessage("Loading samples…");
  try {
    await scheduler.start(scheduler.playheadSec);
    setIsPlaying(true);
  } finally {
    setIsLoading(false);
    setLoadingMessage(null);
  }
}

export function transportStop(scheduler: Scheduler): void {
  scheduler.stop();
  setIsPlaying(false);
  setPlayheadSec(scheduler.playheadSec);
}

export function transportSeek(scheduler: Scheduler, sec: number): void {
  scheduler.seek(sec);
  setPlayheadSec(scheduler.playheadSec);
  if (!isPlaying()) {
    /* nothing else to do — UI cursor follows playheadSec signal */
  }
}
