// Single source of truth for the *persisted* DAW project.
// All UI components read & write through these helpers; never mutate directly.

import { createStore, produce } from "solid-js/store";
import {
  SCHEMA_VERSION,
  type ProjectDoc,
  type Track,
  type Clip,
  type TrackId,
  type ClipId,
  type AudioAsset,
  type AssetId,
  type MasterBus,
  type Transport,
} from "~/lib/audio/types";

const blank = (): ProjectDoc => ({
  schemaVersion: SCHEMA_VERSION,
  id: "",
  name: "Untitled",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  transport: { bpm: 120, timeSig: [4, 4], playheadSec: 0 },
  master: { gainDb: 0 },
  tracks: [],
  assets: [],
});

export const [project, setProject] = createStore<ProjectDoc>(blank());

// ─── load / replace ────────────────────────────────────────────────────────
export function hydrateProject(doc: ProjectDoc): void {
  setProject(doc);
}
export function newBlankProject(id: string, name: string): void {
  const d = blank();
  d.id = id;
  d.name = name;
  setProject(d);
}

// ─── transport ─────────────────────────────────────────────────────────────
export function setBpm(bpm: number): void {
  setProject("transport", "bpm", Math.max(20, Math.min(300, bpm)));
}
export function setPlayhead(sec: number): void {
  setProject("transport", "playheadSec", Math.max(0, sec));
}
export function patchTransport(p: Partial<Transport>): void {
  setProject("transport", (t) => ({ ...t, ...p }));
}

// ─── master ────────────────────────────────────────────────────────────────
export function setMasterGainDb(db: number): void {
  setProject("master", "gainDb", db);
}
export function patchMaster(p: Partial<MasterBus>): void {
  setProject("master", (m) => ({ ...m, ...p }));
}

// ─── tracks ────────────────────────────────────────────────────────────────
export function addTrack(t: Omit<Track, "index" | "clips">): TrackId {
  const idx = project.tracks.length;
  setProject("tracks", (ts) => [...ts, { ...t, index: idx, clips: [] }]);
  return t.id;
}
export function removeTrack(id: TrackId): void {
  setProject(
    "tracks",
    produce((ts) => {
      const i = ts.findIndex((t) => t.id === id);
      if (i >= 0) ts.splice(i, 1);
      ts.forEach((t, n) => (t.index = n));
    }),
  );
}
export function patchTrack(id: TrackId, patch: Partial<Track>): void {
  setProject(
    "tracks",
    (t) => t.id === id,
    produce((t: Track) => {
      Object.assign(t, patch);
    }),
  );
}
export function setTrackGainDb(id: TrackId, db: number): void {
  patchTrack(id, { gainDb: db });
}
export function setTrackPan(id: TrackId, pan: number): void {
  patchTrack(id, { pan: Math.max(-1, Math.min(1, pan)) });
}
export function toggleTrackMute(id: TrackId): void {
  const t = project.tracks.find((x) => x.id === id);
  if (t) patchTrack(id, { muted: !t.muted });
}
export function toggleTrackSolo(id: TrackId): void {
  const t = project.tracks.find((x) => x.id === id);
  if (t) patchTrack(id, { soloed: !t.soloed });
}

// ─── clips ─────────────────────────────────────────────────────────────────
export function addClip(trackId: TrackId, clip: Clip): void {
  setProject(
    "tracks",
    (t) => t.id === trackId,
    "clips",
    (cs) => [...cs, clip],
  );
}
export function removeClip(trackId: TrackId, clipId: ClipId): void {
  setProject(
    "tracks",
    (t) => t.id === trackId,
    "clips",
    (cs) => cs.filter((c) => c.id !== clipId),
  );
}
export function patchClip(
  trackId: TrackId,
  clipId: ClipId,
  patch: Partial<Clip>,
): void {
  setProject(
    "tracks",
    (t) => t.id === trackId,
    "clips",
    (c) => c.id === clipId,
    produce((c: Clip) => {
      Object.assign(c, patch);
    }),
  );
}
export function moveClip(trackId: TrackId, clipId: ClipId, startSec: number): void {
  patchClip(trackId, clipId, { startSec: Math.max(0, startSec) });
}

// ─── assets ────────────────────────────────────────────────────────────────
export function registerAsset(asset: AudioAsset): void {
  setProject("assets", (a) => {
    if (a.some((x) => x.id === asset.id)) return a;
    return [...a, asset];
  });
}
export function findAsset(id: AssetId): AudioAsset | undefined {
  return project.assets.find((a) => a.id === id);
}
