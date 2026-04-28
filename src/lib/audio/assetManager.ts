// AssetManager — given an assetId, return a decoded AudioBuffer.
// 3-tier cache: in-memory LRU → IndexedDB → network.
// Dedupes concurrent requests for the same asset.

import { getAudioContext } from "./context";
import { idbGet, idbPut, idbHas } from "~/lib/storage/idb";
import type { AssetId } from "./types";

/** Resolves a signed/public URL for an asset. Pluggable so we can swap
 *  R2 / S3 / local dev URLs without touching the manager. */
export type UrlResolver = (assetId: AssetId) => Promise<string> | string;

interface Entry {
  buffer: AudioBuffer;
  bytes: number;        // approx memory footprint (frames * channels * 4)
  lastUsed: number;
}

export interface AssetManagerOptions {
  /** Soft cap for the in-memory LRU. 256 MB default. */
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

  /** Main entry point. Returns a decoded AudioBuffer ready to play. */
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

  /** Fetch ahead-of-time without forcing a play. Useful on project load. */
  async preload(ids: Iterable<AssetId>): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    for (const id of ids) {
      if (!this.mem.has(id)) tasks.push(this.get(id).catch(() => {}));
    }
    await Promise.all(tasks);
  }

  /** Drop a buffer from RAM (kept in IDB). */
  evict(id: AssetId): void {
    const e = this.mem.get(id);
    if (e) {
      this.currentBytes -= e.bytes;
      this.mem.delete(id);
    }
  }

  /** Clear everything from RAM. IDB untouched. */
  clearMemory(): void {
    this.mem.clear();
    this.currentBytes = 0;
  }

  /** Quick check: is the raw byte cache populated? */
  hasInIDB(id: AssetId): Promise<boolean> {
    return idbHas(id);
  }

  // ────────────────────────────────────────────────────────────────────────

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
      // Fire-and-forget IDB write; failure shouldn't block playback.
      idbPut(id, bytes.slice(0)).catch((err) =>
        console.warn("idbPut failed", id, err),
      );
    }

    // decode (decodeAudioData consumes the ArrayBuffer; clone first)
    const ctx = getAudioContext();
    const decoded = await ctx.decodeAudioData(bytes.slice(0));

    const footprint =
      decoded.length * decoded.numberOfChannels * 4 /* Float32 */;
    this.admit(id, decoded, footprint);
    return decoded;
  }

  /** Insert into LRU, evicting oldest entries until under cap. */
  private admit(id: AssetId, buffer: AudioBuffer, footprint: number): void {
    // If a single asset is huger than the cap, still admit but don't try to evict to nothing.
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
