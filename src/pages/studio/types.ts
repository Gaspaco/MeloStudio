export type TrackType = "drum" | "voice" | "instrument" | "sampler" | "bass" | "guitar";

export type ClipKind = "audio" | "midi" | "video";

export interface MediaClip {
  id: string;
  kind: ClipKind;
  name: string;
  barStart: number;
  bars: number;
  url?: string;
}

export interface UITrack {
  id: string;
  name: string;
  type: TrackType;
  muted: boolean;
  solo: boolean;
  volume: number; // 0..1
  pan: number;    // -1..1
  color: string;
  clips?: MediaClip[];
}

export const TRACK_DEFS: {
  type: TrackType; label: string; sub?: string;
  tag: string; ready: boolean; icon: string; color: string;
}[] = [
  { type: "instrument", label: "Instrument",    sub: "Piano, lead, pad, plucks — playable from your keyboard", tag: "MIDI",   ready: true,  icon: "instrument", color: "#3ee08b" },
  { type: "drum",       label: "Drum Machine",  sub: "Step-sequenced kit · ready in seconds",                  tag: "RHYTHM", ready: true,  icon: "drum",       color: "#f5b53e" },
  { type: "bass",       label: "Bass Synth",    sub: "Deep monophonic bass — keyboard playable",               tag: "MIDI",   ready: true,  icon: "bass",       color: "#1d87f5" },
  { type: "voice",      label: "Voice / Audio", sub: "Capture vocals or any external sound source",            tag: "AUDIO",  ready: false, icon: "voice",      color: "#f53e3e" },
  { type: "sampler",    label: "Sampler",       sub: "Turn any audio clip into a playable instrument",         tag: "MIDI",   ready: false, icon: "sampler",    color: "#a93ef5" },
  { type: "guitar",     label: "Guitar",        sub: "Acoustic & Electric Guitars — keyboard playable",        tag: "MIDI",   ready: true,  icon: "guitar",     color: "#f53ee0" },
];

export const DRUM_LABEL: Record<string, string> = {
  kick: "Kick", snare: "Snare", hat_closed: "Hi-Hat", hat_open: "Open Hat",
  clap: "Clap", tom_hi: "Tom Hi", tom_lo: "Tom Lo", rimshot: "Rimshot",
};

export const fmtTime = (sec: number): string => {
  if (sec < 0 || !isFinite(sec)) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
};

export const TRACK_COLORS = [
  "#3ee08b", "#1d87f5", "#f5b53e", "#a93ef5", "#3eddf5", "#f53e8a",
  "#9af53e", "#f57c3e", "#3ef5d4", "#cf5cf5", "#5cf593", "#f5e23e",
];

export const randomTrackColor = (avoid?: string): string => {
  const pool = avoid ? TRACK_COLORS.filter(c => c !== avoid) : TRACK_COLORS;
  return pool[Math.floor(Math.random() * pool.length)] ?? TRACK_COLORS[0]!;
};

export const PRESET_ADSR = {
  lead: { attack: 0.005, decay: 0.2,  sustain: 0.7, release: 0.25, filterFreq: 1500 },
  pad:  { attack: 0.6,   decay: 0.3,  sustain: 0.8, release: 1.2,  filterFreq: 800  },
} as const;
