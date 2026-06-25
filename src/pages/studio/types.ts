import type { SynthPreset } from "~/lib/audio/synth";

export type TrackType = "drum" | "voice" | "instrument" | "sampler" | "bass" | "guitar";

export type ClipKind = "audio" | "midi" | "video";

export interface MidiNoteEvent {
  midi: number;
  startBars: number;
  durationBars: number;
  velocity: number;
}

export interface MediaClip {
  id: string;
  assetId?: string;
  kind: ClipKind;
  name: string;
  barStart: number;
  bars: number;
  /** The full original extent of the clip content in bars — set once at creation and never reduced.
   * Used to cap non-destructive right-trim expansion so the user can always drag the right edge
   * back out to recover the original underlying material (Logic Pro behavior). */
  originalBars?: number;
  sourceOffsetBars?: number;
  widthPx?: number;
  leftPx?: number;
  pitch?: number;       // semitones, default 0
  playbackRate?: number; // speed multiplier, default 1
  gain?: number;        // dB, default 0
  midiNotes?: MidiNoteEvent[];
  drumPattern?: boolean;
  reversed?: boolean;
  url?: string;
  dataUrl?: string;
  remoteUrl?: string;
}

export interface UITrack {
  id: string;
  name: string;
  type: TrackType;
  instrumentPreset?: SynthPreset;
  muted: boolean;
  solo: boolean;
  recordArmed?: boolean;
  volume: number; // 0..1
  pan: number;    // -1..1
  color: string;
  clips?: MediaClip[];
}

export const isAudioTrackType = (type: TrackType): boolean =>
  type === "voice";

export const isInstrumentTrackType = (type: TrackType): boolean =>
  type === "instrument" || type === "bass" || type === "guitar";

export const isTrackTypeAllowedForClipKind = (trackType: TrackType, clipKind: ClipKind): boolean => {
  if (clipKind === "audio" || clipKind === "video") return isAudioTrackType(trackType);
  if (clipKind === "midi") return isInstrumentTrackType(trackType);
  return false;
};

export const isTrackAllowedForClip = (track: UITrack, clip: MediaClip): boolean =>
  clip.drumPattern
    ? track.type === "drum"
    : isTrackTypeAllowedForClipKind(track.type, clip.kind);

export const createDrumPatternRegions = (bars = 4): MediaClip[] =>
  Array.from({ length: Math.max(1, Math.round(bars)) }, (_, bar) => ({
    id: crypto.randomUUID(),
    kind: "midi",
    drumPattern: true,
    name: `Drum Pattern ${String.fromCharCode(65 + (bar % 26))}`,
    barStart: bar,
    bars: 1,
    leftPx: bar * 240,
    widthPx: 240,
  }));

export const hasPatternContent = (pattern: { rows?: Array<{ velocities?: number[] }> } | null | undefined): boolean =>
  Boolean(pattern?.rows?.some(row => row.velocities?.some(velocity => velocity > 0)));

export const hasTrackContent = (tracks: UITrack[] | null | undefined): boolean =>
  Boolean(tracks?.some(track => (track.clips ?? []).length > 0));

export const hasStudioContent = (
  tracks: UITrack[] | null | undefined,
  pattern: { rows?: Array<{ velocities?: number[] }> } | null | undefined,
  lyrics?: string | null,
): boolean => hasTrackContent(tracks) || hasPatternContent(pattern) || Boolean(lyrics?.trim());

export const TRACK_DEFS: {
  type: TrackType; label: string; sub?: string;
  tag: string; ready: boolean; icon: string; color: string;
}[] = [
  { type: "instrument", label: "Instrument",    sub: "Piano, lead, pad, bell, plucks — playable from your keyboard", tag: "MIDI",   ready: true,  icon: "instrument", color: "#3ee08b" },
  { type: "drum",       label: "Drum Machine",  sub: "Step-sequenced kit · ready in seconds",                  tag: "RHYTHM", ready: true,  icon: "drum",       color: "#f5b53e" },
  { type: "bass",       label: "Bass Synth",    sub: "Deep monophonic bass — keyboard playable",               tag: "MIDI",   ready: true,  icon: "bass",       color: "#1d87f5" },
  { type: "voice",      label: "Voice / Audio", sub: "Capture vocals or any external sound source",            tag: "AUDIO",  ready: true,  icon: "voice",      color: "#f53e3e" },
  { type: "sampler",    label: "Sampler",       sub: "Turn any audio clip into a playable instrument",         tag: "MIDI",   ready: false, icon: "sampler",    color: "#a93ef5" },
  { type: "guitar",     label: "Guitar",        sub: "Acoustic & Electric Guitars — keyboard playable",        tag: "MIDI",   ready: true,  icon: "guitar",     color: "#f53ee0" },
];

export const DRUM_LABEL: Record<string, string> = {
  kick: "Kick", snare: "Snare", hat_closed: "Hi-Hat", hat_open: "Open Hat",
  clap: "Clap", tom_hi: "Tom Hi", tom_lo: "Tom Lo", rimshot: "Rimshot",
};

export const fmtTime = (sec: number): string => {
  if (sec < 0 || !isFinite(sec)) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100); // 2-digit ms feels more standard for a DAW
  
  const mStr = h > 0 ? m.toString().padStart(2, "0") : m.toString().padStart(2, "0");
  const sStr = s.toString().padStart(2, "0");
  const msStr = ms.toString().padStart(2, "0");
  
  if (h > 0) return `${h.toString().padStart(2, "0")}:${mStr}:${sStr}.${msStr}`;
  return `${mStr}:${sStr}.${msStr}`;
};

export const TRACK_COLORS = [
  "#3ee08b", "#1d87f5", "#f5b53e", "#a93ef5", "#3eddf5", "#f53e8a",
  "#9af53e", "#f57c3e", "#3ef5d4", "#cf5cf5", "#5cf593", "#f5e23e",
];

export const randomTrackColor = (avoid?: string): string => {
  const pool = avoid ? TRACK_COLORS.filter(c => c !== avoid) : TRACK_COLORS;
  return pool[Math.floor(Math.random() * pool.length)] ?? TRACK_COLORS[0] ?? "#3ee08b";
};

export const PRESET_ADSR = {
  lead: { attack: 0.005, decay: 0.2,  sustain: 0.7, release: 0.25, filterFreq: 1500 },
  pad:  { attack: 0.6,   decay: 0.3,  sustain: 0.8, release: 1.2,  filterFreq: 800  },
} as const;

export interface StudioTemplate {
  id:      string;
  name:    string;
  genre:   string;
  bpm:     number;
  color:   string;
  tracks:  Array<{ type: TrackType; name: string }>;
  pattern?: Partial<Record<string, number[]>>;
}

const _v = (on: number[], len = 16): number[] =>
  Array.from({ length: len }, (_, i) => (on.includes(i) ? 0.85 : 0));
const _s = (on: number[], len = 16): number[] =>
  Array.from({ length: len }, (_, i) => (on.includes(i) ? 0.45 : 0));

export const TEMPLATES: StudioTemplate[] = [
  {
    id: "boom-bap", name: "Boom Bap", genre: "Hip Hop", bpm: 90, color: "#f5b53e",
    tracks: [
      { type: "drum",       name: "Drums" },
      { type: "bass",       name: "Bass"  },
      { type: "instrument", name: "Keys"  },
    ],
    pattern: {
      kick:       _v([0, 6, 8, 14]),
      snare:      _v([4, 12]),
      hat_closed: _v([0, 2, 4, 6, 8, 10, 12, 14]),
      hat_open:   _s([6, 14]),
      clap:       _s([4, 12]),
    },
  },
  {
    id: "trap", name: "Trap", genre: "Trap", bpm: 140, color: "#a93ef5",
    tracks: [
      { type: "drum",       name: "Drums"  },
      { type: "bass",       name: "808s"   },
      { type: "instrument", name: "Melody" },
    ],
    pattern: {
      kick:       _v([0, 3, 9]),
      snare:      _v([4, 12]),
      hat_closed: Array(16).fill(0.45) as number[],
      hat_open:   _v([6, 14]),
    },
  },
  {
    id: "lo-fi", name: "Lo-Fi", genre: "Chill", bpm: 75, color: "#3eddf5",
    tracks: [
      { type: "drum",       name: "Drums" },
      { type: "instrument", name: "Piano" },
      { type: "bass",       name: "Bass"  },
    ],
    pattern: {
      kick:       _v([0, 9, 11]),
      snare:      _v([4, 12]),
      hat_closed: _s([0, 2, 4, 6, 8, 10, 12, 14]),
      hat_open:   _s([14]),
    },
  },
  {
    id: "pop", name: "Pop", genre: "Pop", bpm: 120, color: "#f53e8a",
    tracks: [
      { type: "drum",       name: "Drums" },
      { type: "instrument", name: "Lead"  },
      { type: "bass",       name: "Bass"  },
    ],
    pattern: {
      kick:       _v([0, 4, 8, 12]),
      snare:      _v([4, 12]),
      hat_closed: _v([0, 2, 4, 6, 8, 10, 12, 14]),
      clap:       _s([4, 12]),
    },
  },
  {
    id: "house", name: "House", genre: "Electronic", bpm: 126, color: "#3ee08b",
    tracks: [
      { type: "drum",       name: "Drums" },
      { type: "instrument", name: "Synth" },
      { type: "bass",       name: "Bass"  },
    ],
    pattern: {
      kick:       _v([0, 4, 8, 12]),
      clap:       _v([4, 12]),
      hat_closed: _s([2, 6, 10, 14]),
      hat_open:   _v([6, 14]),
    },
  },
];
