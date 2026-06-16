type TimelineClip = {
  id?: string;
  kind?: string;
  barStart?: number;
  bars?: number;
  startSec?: number;
  durationSec?: number;
  dataUrl?: string;
  remoteUrl?: string;
  muted?: boolean;
};

type TimelineTrack = {
  id?: string;
  name?: string;
  volume?: number;
  gainDb?: number;
  muted?: boolean;
  clips?: TimelineClip[];
};

export type TimelineDoc = {
  tracks?: TimelineTrack[];
  uiTracks?: TimelineTrack[];
};

export type SharePlaybackClip = {
  id: string;
  startSec: number;
  durationSec: number;
  dataUrl?: string;
  remoteUrl?: string;
};

export type SharePlaybackTrack = {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  clips: SharePlaybackClip[];
};

const dbToGain = (db: number): number =>
  db <= -60 ? 0 : Math.pow(10, db / 20);

const secondsPerBar = (bpm: number): number => (4 * 60) / (bpm || 120);

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeClip(clip: TimelineClip, bpm: number): SharePlaybackClip | null {
  if (!clip.id || clip.kind === "midi" || clip.muted) return null;

  const secPerBar = secondsPerBar(bpm);
  const hasSeconds = typeof clip.startSec === "number" || typeof clip.durationSec === "number";
  const startSec = hasSeconds
    ? finiteNumber(clip.startSec)
    : finiteNumber(clip.barStart) * secPerBar;
  const durationSec = hasSeconds
    ? finiteNumber(clip.durationSec)
    : Math.max(1, finiteNumber(clip.bars, 1)) * secPerBar;

  return { id: clip.id, startSec: Math.max(0, startSec), durationSec: Math.max(0, durationSec), dataUrl: clip.dataUrl, remoteUrl: clip.remoteUrl };
}

export function getSharePlaybackTracks(doc: TimelineDoc, bpm: number): SharePlaybackTrack[] {
  // Prefer `uiTracks` (current schema); fall back to `tracks` for projects saved before the field was renamed
  const sourceTracks = (doc.uiTracks?.length ? doc.uiTracks : doc.tracks) ?? [];

  return sourceTracks
    .map((track) => ({
      id: track.id ?? "",
      name: track.name ?? "Track",
      volume: finiteNumber(track.volume, typeof track.gainDb === "number" ? dbToGain(track.gainDb) : 1),
      muted: !!track.muted,
      clips: (track.clips ?? [])
        .map((clip) => normalizeClip(clip, bpm))
        .filter((clip): clip is SharePlaybackClip => !!clip),
    }))
    .filter((track) => track.id && track.clips.length > 0);
}

export function getProjectDurationSec(doc: TimelineDoc, bpm: number): number {
  let durationSec = 0;
  for (const track of getSharePlaybackTracks(doc, bpm)) {
    for (const clip of track.clips) {
      const end = clip.startSec + clip.durationSec;
      if (end > durationSec) durationSec = end;
    }
  }
  return durationSec;
}

export function getProjectTrackCount(doc: TimelineDoc): number {
  return (doc.uiTracks?.length ? doc.uiTracks : doc.tracks)?.length ?? 0;
}