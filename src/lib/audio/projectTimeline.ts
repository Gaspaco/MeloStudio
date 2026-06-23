type TimelineClip = {
  id?: string;
  assetId?: string;
  kind?: string;
  barStart?: number;
  bars?: number;
  startSec?: number;
  durationSec?: number;
  dataUrl?: string;
  remoteUrl?: string;
  muted?: boolean;
  midiNotes?: Array<{
    midi?: number;
    startBars?: number;
    durationBars?: number;
    velocity?: number;
  }>;
};

type TimelineTrack = {
  id?: string;
  name?: string;
  type?: string;
  volume?: number;
  gainDb?: number;
  muted?: boolean;
  instrumentPreset?: string;
  clips?: TimelineClip[];
};

export type TimelineDoc = {
  tracks?: TimelineTrack[];
  uiTracks?: TimelineTrack[];
};

export type SharePlaybackClip = {
  id: string;
  kind: "audio" | "video" | "midi";
  startSec: number;
  durationSec: number;
  dataUrl?: string;
  remoteUrl?: string;
  midiNotes?: Array<{
    midi: number;
    startSec: number;
    durationSec: number;
    velocity: number;
  }>;
};

export type SharePlaybackTrack = {
  id: string;
  name: string;
  type: string;
  volume: number;
  muted: boolean;
  instrumentPreset?: string;
  clips: SharePlaybackClip[];
};

const dbToGain = (db: number): number =>
  db <= -60 ? 0 : Math.pow(10, db / 20);

const secondsPerBar = (bpm: number): number => (4 * 60) / (bpm || 120);

const sharedClipUrl = (projectId: string, clipId: string): string =>
  `/api/clips/${encodeURIComponent(clipId)}?projectId=${encodeURIComponent(projectId)}`;

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeClip(clip: TimelineClip, bpm: number, projectId?: string): SharePlaybackClip | null {
  if (!clip.id || clip.muted) return null;

  const secPerBar = secondsPerBar(bpm);
  const hasSeconds = typeof clip.startSec === "number" || typeof clip.durationSec === "number";
  const startSec = hasSeconds
    ? finiteNumber(clip.startSec)
    : finiteNumber(clip.barStart) * secPerBar;
  const durationSec = hasSeconds
    ? finiteNumber(clip.durationSec)
    : Math.max(1, finiteNumber(clip.bars, 1)) * secPerBar;

  if (clip.kind === "midi") {
    return {
      id: clip.id,
      kind: "midi",
      startSec: Math.max(0, startSec),
      durationSec: Math.max(0, durationSec),
      midiNotes: (clip.midiNotes ?? [])
        .map((note) => ({
          midi: Math.max(0, Math.min(127, Math.round(finiteNumber(note.midi)))),
          startSec: finiteNumber(note.startBars) * secPerBar,
          durationSec: Math.max(0.02, finiteNumber(note.durationBars, 0.05) * secPerBar),
          velocity: Math.max(0.05, Math.min(1, finiteNumber(note.velocity, 0.8))),
        }))
        .filter((note) => note.durationSec > 0),
    };
  }

  const sourceId = clip.assetId ?? clip.id;

  return {
    id: sourceId,
    kind: clip.kind === "video" ? "video" : "audio",
    startSec: Math.max(0, startSec),
    durationSec: Math.max(0, durationSec),
    dataUrl: clip.dataUrl,
    remoteUrl: clip.remoteUrl ?? (projectId ? sharedClipUrl(projectId, sourceId) : undefined),
  };
}

export function getSharePlaybackTracks(doc: TimelineDoc, bpm: number, projectId?: string): SharePlaybackTrack[] {
  // Prefer `uiTracks` (current schema); fall back to `tracks` for projects saved before the field was renamed
  const sourceTracks = (doc.uiTracks?.length ? doc.uiTracks : doc.tracks) ?? [];

  return sourceTracks
    .map((track) => ({
      id: track.id ?? "",
      name: track.name ?? "Track",
      type: track.type ?? "voice",
      volume: finiteNumber(track.volume, typeof track.gainDb === "number" ? dbToGain(track.gainDb) : 1),
      muted: !!track.muted,
      instrumentPreset: track.instrumentPreset,
      clips: (track.clips ?? [])
        .map((clip) => normalizeClip(clip, bpm, projectId))
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
