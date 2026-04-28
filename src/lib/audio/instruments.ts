// Instrument catalog + lazy-loading manifest fetcher.
// Manifests are static JSON files served from /public or a CDN.

import type { AssetId } from "./types";

/** A single playable trigger inside a pack (one drum hit, one note, etc). */
export interface SampleTrigger {
  /** Stable id within the pack (e.g. "kick_01"). */
  id: string;
  name: string;
  /** Hash-based asset id — same one the AssetManager uses. */
  assetId: AssetId;
  /** UI tag (e.g. "kick", "snare", "808"). */
  tag?: string;
  /** Default pitch in semitones (e.g. for chromatic instruments). */
  rootNote?: number;
  /** Default per-trigger gain, in dB. */
  gainDb?: number;
}

export interface InstrumentPack {
  id: string;                 // "trap-drums"
  name: string;               // "Trap Drums"
  description?: string;
  cover?: string;             // image URL for the UI
  category: "drums" | "bass" | "synth" | "fx" | "loops" | "other";
  triggers: SampleTrigger[];
}

/** Tiny entry in the top-level catalog — manifest URL is fetched lazily. */
export interface CatalogEntry {
  id: string;
  name: string;
  category: InstrumentPack["category"];
  cover?: string;
  /** URL to the full manifest (static JSON). */
  manifestUrl: string;
  /** How many triggers, for showing in card without loading manifest. */
  triggerCount: number;
}

export interface InstrumentCatalog {
  version: number;
  packs: CatalogEntry[];
}

// ─────────────────────────────────────────────────────────────────────────

export interface InstrumentLibraryOptions {
  catalogUrl: string;
}

/** Fetches and caches the catalog + per-pack manifests. */
export class InstrumentLibrary {
  private catalogUrl: string;
  private catalog: InstrumentCatalog | null = null;
  private catalogPromise: Promise<InstrumentCatalog> | null = null;
  private packs = new Map<string, InstrumentPack>();
  private packPromises = new Map<string, Promise<InstrumentPack>>();

  constructor(opts: InstrumentLibraryOptions) {
    this.catalogUrl = opts.catalogUrl;
  }

  /** Get the top-level catalog (cached after first call). */
  async getCatalog(): Promise<InstrumentCatalog> {
    if (this.catalog) return this.catalog;
    if (this.catalogPromise) return this.catalogPromise;
    this.catalogPromise = (async () => {
      const res = await fetch(this.catalogUrl, { credentials: "omit" });
      if (!res.ok) throw new Error(`catalog: ${res.status}`);
      const cat = (await res.json()) as InstrumentCatalog;
      this.catalog = cat;
      return cat;
    })();
    return this.catalogPromise;
  }

  /** Lazy-load a pack manifest. Dedupes concurrent calls. */
  async getPack(id: string): Promise<InstrumentPack> {
    const cached = this.packs.get(id);
    if (cached) return cached;
    const inflight = this.packPromises.get(id);
    if (inflight) return inflight;

    const promise = (async () => {
      const cat = await this.getCatalog();
      const entry = cat.packs.find((p) => p.id === id);
      if (!entry) throw new Error(`pack not found: ${id}`);
      const res = await fetch(entry.manifestUrl, { credentials: "omit" });
      if (!res.ok) throw new Error(`pack ${id}: ${res.status}`);
      const pack = (await res.json()) as InstrumentPack;
      this.packs.set(id, pack);
      return pack;
    })().finally(() => this.packPromises.delete(id));

    this.packPromises.set(id, promise);
    return promise;
  }

  /** Find a trigger by its assetId across already-loaded packs (no fetch). */
  findTriggerByAsset(assetId: AssetId): SampleTrigger | null {
    for (const pack of this.packs.values()) {
      const t = pack.triggers.find((x) => x.assetId === assetId);
      if (t) return t;
    }
    return null;
  }

  /** Drop a manifest from memory. Underlying audio in IDB is untouched. */
  evictPack(id: string): void {
    this.packs.delete(id);
  }
}
