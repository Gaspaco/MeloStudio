// AssetManager is the core audio sample loader, decoding compressed audio into raw PCM Web Audio Buffers.
// It uses a robust three-tier caching system to make the DAW feel instant:
// 1. RAM (LRU Cache) - Instant playback if the sample was used recently.
// 2. IndexedDB - Local browser storage. Survives page reloads without network hits.
// 3. Network Fetch - If missing locally, it fetches from the CDN or edge storage.
// 
// Coalescing: It prevents duplicate downloads. If ten tracks simultaneously request "kick.wav", 
// the AssetManager collapses them into a single inflight fetch promise.

import { getAudioContext } from "./context";
import { idbGet, idbPut, idbHas } from "~/lib/storage/idb";
import type { AssetId } from "./types";

export type UrlResolver = (assetId: AssetId) => Promise<string> | string;

interface Entry {
  buffer: AudioBuffer;
  bytes: number;        // approx memory footprint (frames * channels * 4)
  lastUsed: number;
}

export interface AssetManagerOptions {
  // soft cap for the in-memory LRU. 256 MB default
  maxMemoryBytes?: number;
  resolveUrl: UrlResolver;
}

export class AssetManager {
  private mem = new Map<AssetId, Entry>();
  private inflight = new Map<AssetId, Promise<AudioBuffer>>();
  private maxBytes: number;
  private currentBytes = 0;
  private resolveUrl: UrlResolver;

  constructor(opts: AssetManagerOptions) {
    this.maxBytes = opts.maxMemoryBytes ?? 256 * 1024 * 1024;
    this.resolveUrl = opts.resolveUrl;
  }

  async get(id: AssetId): Promise<AudioBuffer> {
    // 1. RAM LRU
    const hit = this.mem.get(id);
    if (hit) {
      hit.lastUsed = performance.now();
      return hit.buffer;
    }

    // 2. dedupe concurrent loads
    const pending = this.inflight.get(id);
    if (pending) return pending;

    const promise = this.load(id).finally(() => this.inflight.delete(id));
    this.inflight.set(id, promise);
    return promise;
  }

  async preload(ids: Iterable<AssetId>): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    for (const id of ids) {
      if (!this.mem.has(id)) tasks.push(this.get(id).catch(() => {}));
    }
    await Promise.all(tasks);
  }

  evict(id: AssetId): void {
    const e = this.mem.get(id);
    if (e) {
      this.currentBytes -= e.bytes;
      this.mem.delete(id);
    }
  }

  clearMemory(): void {
    this.mem.clear();
    this.currentBytes = 0;
  }

  hasInIDB(id: AssetId): Promise<boolean> {
    return idbHas(id);
  }

  private async load(id: AssetId): Promise<AudioBuffer> {
    // 2. IDB byte cache
    let bytes = await idbGet(id);

    // 3. network
    if (!bytes) {
      const url = await this.resolveUrl(id);
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) {
        throw new Error(`asset ${id}: ${res.status} ${res.statusText}`);
      }
      bytes = await res.arrayBuffer();
      // IDB write is fire-and-forget — failure shouldn't stall playback
      idbPut(id, bytes.slice(0)).catch((err) =>
        console.warn("idbPut failed", id, err),
      );
    }

    // decodeAudioData consumes the buffer, so slice it first
    const ctx = getAudioContext();
    const decoded = await ctx.decodeAudioData(bytes.slice(0));

    const footprint =
      decoded.length * decoded.numberOfChannels * 4 /* Float32 */;
    this.admit(id, decoded, footprint);
    return decoded;
  }

  private admit(id: AssetId, buffer: AudioBuffer, footprint: number): void {
    // Single oversized asset: admit it anyway, don't loop forever trying to free space.
    while (
      this.currentBytes + footprint > this.maxBytes &&
      this.mem.size > 0
    ) {
      let oldestId: AssetId | null = null;
      let oldestT = Infinity;
      for (const [k, v] of this.mem) {
        if (v.lastUsed < oldestT) {
          oldestT = v.lastUsed;
          oldestId = k;
        }
      }
      if (!oldestId || oldestId === id) break;
      this.evict(oldestId);
    }
    this.mem.set(id, {
      buffer,
      bytes: footprint,
      lastUsed: performance.now(),
    });
    this.currentBytes += footprint;
  }
}
