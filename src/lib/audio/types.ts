// Core DAW types — shared by DB, engine, and UI.
// Version this shape; bump SCHEMA_VERSION on breaking changes so old projects can be migrated.

export const SCHEMA_VERSION = 1;

/** Stable hash-based id (sha256 of file bytes) — dedupes identical samples. */
export type AssetId = string;
export type ProjectId = string;
export type TrackId = string;
export type ClipId = string;

/** A reference to an audio file living in object storage (R2/S3). */
export interface AudioAsset {
  id: AssetId;
  name: string;
  mime: string;          // "audio/wav" | "audio/mpeg" | ...
  durationSec: number;   // canonical length of the source file
  sampleRate: number;    // source SR; engine resamples if needed
  channels: 1 | 2;
  /** Storage key in R2/S3, NOT a public URL. The API mints signed URLs on demand. */
  storageKey: string;
  /** Optional pre-computed peaks for fast waveform render. */
  peaksKey?: string;
  bytes: number;
  sha256: string;        // == id, kept explicit for clarity
}

/** A clip places (a region of) an asset on a track at a specific time. */
export interface Clip {
  id: ClipId;
  assetId: AssetId;
  /** Project-time start, in seconds (NOT beats — beats are derived via BPM). */
  startSec: number;
  /** How much of the asset to play (defaults to asset.durationSec). */
  durationSec: number;
  /** Offset INTO the asset where playback begins. */
  offsetSec: number;
  /** Per-clip gain in dB. 0 = unity. */
  gainDb: number;
  /** Optional fades, in seconds. */
  fadeInSec?: number;
  fadeOutSec?: number;
  /** Optional pitch shift in semitones (engine may use playbackRate or worklet). */
  pitchSemitones?: number;
  /** Optional per-clip mute. */
  muted?: boolean;
}

export interface Track {
  id: TrackId;
  name: string;
  /** Color used by the UI. */
  color: string;
  gainDb: number;       // -inf..+12 (clamped UI-side)
  pan: number;          // -1..+1
  muted: boolean;
  soloed: boolean;
  /** Order is implicit (array index) but kept for safety. */
  index: number;
  clips: Clip[];
  /** Optional insert chain (reverb, eq, …) — IDs only; engine resolves. */
  inserts?: InsertEffect[];
}

export interface InsertEffect {
  id: string;
  type: string;          // "eq" | "reverb" | "compressor" | ...
  bypass: boolean;
  params: Record<string, number>;
}

/** Master bus settings. */
export interface MasterBus {
  gainDb: number;
  inserts?: InsertEffect[];
}

/** Transport / tempo / time signature. */
export interface Transport {
  bpm: number;
  /** Numerator / denominator (e.g. 4/4). */
  timeSig: [number, number];
  /** Last known playhead, persisted so reload restores position. */
  playheadSec: number;
  /** Loop region, if any. */
  loop?: { startSec: number; endSec: number; enabled: boolean };
}

/** The full document persisted as JSONB in Postgres. */
export interface ProjectDoc {
  schemaVersion: number;
  id: ProjectId;
  name: string;
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
  transport: Transport;
  master: MasterBus;
  tracks: Track[];
  /** Asset *references* used by this project. The actual blobs live in R2. */
  assets: AudioAsset[];
}

/** Convenience helpers — kept here so DB, engine, and UI all agree. */
export const dbToGain = (db: number): number =>
  db <= -60 ? 0 : Math.pow(10, db / 20);

export const gainToDb = (g: number): number =>
  g <= 0 ? -Infinity : 20 * Math.log10(g);
