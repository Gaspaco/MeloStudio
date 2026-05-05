// Connects projectStore and transportStore to the audio engine (AudioGraph + Scheduler).
// Each reactive effect only re-runs for the piece of state it reads.

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
  dispose: () => void;
}

export interface CreateEngineOptions {
  publicAudioPrefix?: string;
  signEndpoint?: string;
  maxMemoryBytes?: number;
}

// set up the audio engine and wire reactive effects to the project store.
// call once when the studio mounts; call dispose() on unmount.
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

  // Push playhead position back to the store, throttled to ~60fps.
  let lastPaint = 0;
  scheduler.onTick = (sec) => {
    const now = performance.now();
    if (now - lastPaint > 16) {
      lastPaint = now;
      setPlayheadSec(sec);
    }
  };

  const dispose = createRoot((disposeRoot) => {

    createEffect(
      on(
        () => project.master,
        (m) => graph.setMaster(m),
      ),
    );

    // re-evaluates on track count/id changes and per-track gain/pan/mute/solo;
    // Solid's fine-grained reactivity means slider A doesn't retrigger track B
    createEffect(() => {
      const anySoloed = project.tracks.some((t) => t.soloed);
      const liveIds = new Set(project.tracks.map((t) => t.id));
      for (const t of project.tracks) {
        graph.upsertTrack(t, anySoloed);
      }
      void liveIds; // tracked for debugger / future eviction hook
    });


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

// start playback from the current playhead
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
