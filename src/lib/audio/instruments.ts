// This module acts as the "Record Store" for the DAW, managing available instruments.
// Rather than hardcoding multi-megabyte soundbanks into the Javascript bundle,
// we define a Catalog structure.
// 1. The main app loads a tiny `catalog.json` listing available packs.
// 2. When the user clicks an instrument pack, we lazily fetch its `manifestUrl` 
//    which contains the actual asset pointers to preload into the audio graph.

import type { AssetId } from "./types";

export interface SampleTrigger {
  id: string;
  name: string;
  assetId: AssetId;
  tag?: string;
  rootNote?: number;
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

// top-level catalog entry — manifest URL is fetched lazily
export interface CatalogEntry {
  id: string;
  name: string;
  category: InstrumentPack["category"];
  cover?: string;
  manifestUrl: string;
  // how many triggers — for showing in the card without loading the full manifest
  triggerCount: number;
}

export interface InstrumentCatalog {
  version: number;
  packs: CatalogEntry[];
}

export interface InstrumentLibraryOptions {
  catalogUrl: string;
}

export class InstrumentLibrary {
  private catalogUrl: string;
  private catalog: InstrumentCatalog | null = null;
  private catalogPromise: Promise<InstrumentCatalog> | null = null;
  private packs = new Map<string, InstrumentPack>();
  private packPromises = new Map<string, Promise<InstrumentPack>>();

  constructor(opts: InstrumentLibraryOptions) {
    this.catalogUrl = opts.catalogUrl;
  }

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

  // lazy-load a pack manifest; dedupes concurrent calls
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

  // find a trigger by asset id across already-loaded packs (no fetch)
  findTriggerByAsset(assetId: AssetId): SampleTrigger | null {
    for (const pack of this.packs.values()) {
      const t = pack.triggers.find((x) => x.assetId === assetId);
      if (t) return t;
    }
    return null;
  }

  // drop a manifest from memory; IDB audio stays untouched
  evictPack(id: string): void {
    this.packs.delete(id);
  }
}
