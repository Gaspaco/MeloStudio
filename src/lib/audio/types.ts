// Core DAW types — shared by DB, engine, and UI.
// Bump SCHEMA_VERSION on any breaking change so old projects can be migrated.

export const SCHEMA_VERSION = 1;

export type AssetId = string;
export type ProjectId = string;
export type TrackId = string;
export type ClipId = string;

export interface AudioAsset {
  id: AssetId;
  name: string;
  mime: string;          // "audio/wav" | "audio/mpeg" | ...
  durationSec: number;   // canonical length of the source file
  sampleRate: number;    // source SR; engine resamples if needed
  channels: 1 | 2;
  // storage key in R2/S3, not a public URL — API mints signed URLs on demand
  storageKey: string;
    peaksKey?: string;
  bytes: number;
  sha256: string;        // == id, kept explicit for clarity
}

export interface Clip {
  barStart: number;
  bars: number;
  id: ClipId;
  assetId: AssetId;
  // project-time start in seconds (not beats — beats are derived from BPM)
  startSec: number;
    durationSec: number;
    offsetSec: number;
  // per-clip gain in dB. 0 = unity
  gainDb: number;
    fadeInSec?: number;
  fadeOutSec?: number;
    pitchSemitones?: number;
    muted?: boolean;
}

export interface Track {
  id: TrackId;
  name: string;
    color: string;
  gainDb: number;       // -inf..+12 (clamped UI-side)
  pan: number;          // -1..+1
  muted: boolean;
  soloed: boolean;
  // order is implicit (array index) but kept here for safety
  index: number;
  clips: Clip[];
  // optional insert chain (reverb, eq, etc) — ids only; engine resolves them
  inserts?: InsertEffect[];
}

export interface InsertEffect {
  id: string;
  type: string;          // "eq" | "reverb" | "compressor" | ...
  bypass: boolean;
  params: Record<string, number>;
}

export interface MasterBus {
  gainDb: number;
  inserts?: InsertEffect[];
}

export interface Transport {
  bpm: number;
  // numerator / denominator (e.g. 4/4)
  timeSig: [number, number];
  // last known playhead, persisted so reload restores position
  playheadSec: number;
    loop?: { startSec: number; endSec: number; enabled: boolean };
}

// the full document stored as JSONB in Postgres
export interface ProjectDoc {
  schemaVersion: number;
  id: ProjectId;
  name: string;
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
  transport: Transport;
  master: MasterBus;
  tracks: Track[];
  // asset references used by this project. actual blobs live in R2
  assets: AudioAsset[];
  // optional musical key label, e.g. "C Major" or "F# Minor"
  musicalKey?: string;
  // optional pre-rendered stereo mix URL (set after export)
  mixUrl?: string;
  // optional public cover art data URL
  coverUrl?: string;
  // track metadata
  genre?: string;
  description?: string;
  explicit?: boolean;
  unlisted?: boolean;
  // lyrics (plain text or LRC format with [MM:SS.xx] timestamps)
  lyrics?: string;
}

export const dbToGain = (db: number): number =>
  db <= -60 ? 0 : Math.pow(10, db / 20);

export const gainToDb = (g: number): number =>
  g <= 0 ? -Infinity : 20 * Math.log10(g);
