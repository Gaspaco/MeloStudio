// Polyphonic synth, powered by Tone.js.
// Public API is unchanged: PolySynth + SynthPreset, with noteOn/noteOff/etc.
//
// "piano", "bass", and "guitar" are *real recorded samples* streamed from
// the tonejs-instruments CDN and played back via Tone.Sampler (it pitch-shifts
// between sampled pitches to cover every MIDI note).
// "lead" and "pad" stay synthesized — they're inherently synth sounds.
//
// While the samples are downloading we route notes through a lightweight
// fallback synth so the keyboard never goes silent.
//
// Authorship: this is shared code. Malikhai wrote a large part of the Tone.js
// synth/sample engine and presets. Niko later added sample preloading plus
// AudioContext and latency recovery fixes.

import * as Tone from "tone";
import { bindToneToContext } from "./context";
import { getMasterBus } from "./masterBus";

export type SynthPreset =
  | "piano" | "bright-piano"
  | "electric-piano" | "organ" | "clavinet" | "reed-organ"
  | "lead" | "analog-lead" | "pulse-lead" | "fm-bell" | "physical-pluck"
  | "vibraphone" | "marimba" | "brass" | "flute" | "choir" | "bells"
  | "pad" | "glass-pad" | "string-ensemble" | "warm-strings" | "space-pad"
  | "bass" | "synth-bass" | "sub-bass" | "wobble-bass" | "acid-bass"
  | "guitar"
  | "drum-kit-acoustic" | "drum-kit-electronic" | "drum-kit-808" | "drum-kit-vinyl" | "drum-kit-orchestra";

interface SynthPresetOptions {
  oscillator: Partial<Tone.OmniOscillatorOptions>;
  envelope: { attack: number; decay: number; sustain: number; release: number };
  filter: { frequency: number; Q: number };
  filterEnvelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    baseFrequency: number;
    octaves: number;
  };
  volume: number; // dB
}

const SYNTH_PRESETS: Record<string, SynthPresetOptions> = {
  lead: {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.25 },
    filter: { frequency: 1500, Q: 4 },
    filterEnvelope: {
      attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.25,
      baseFrequency: 1500, octaves: 1.5,
    },
    volume: 0,
  },
  pad: {
    oscillator: { type: "fatsawtooth", count: 3, spread: 30 },
    envelope: { attack: 0.6, decay: 0.3, sustain: 0.8, release: 1.2 },
    filter: { frequency: 800, Q: 1.2 },
    filterEnvelope: {
      attack: 0.8, decay: 0.4, sustain: 0.6, release: 1.0,
      baseFrequency: 800, octaves: 1,
    },
    volume: 0,
  },
  "electric-piano": {
    oscillator: { type: "sine" },
    envelope: { attack: 0.008, decay: 0.75, sustain: 0.18, release: 1.1 },
    filter: { frequency: 5200, Q: 0.7 },
    filterEnvelope: { attack: 0.005, decay: 0.55, sustain: 0.1, release: 0.8, baseFrequency: 1800, octaves: 1.6 },
    volume: -2,
  },
  organ: {
    oscillator: { type: "fatsine", count: 3, spread: 9 },
    envelope: { attack: 0.025, decay: 0.08, sustain: 0.92, release: 0.22 },
    filter: { frequency: 6200, Q: 0.4 },
    filterEnvelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.2, baseFrequency: 2200, octaves: 1.2 },
    volume: -4,
  },
  "analog-lead": {
    oscillator: { type: "fatsquare", count: 2, spread: 12 },
    envelope: { attack: 0.012, decay: 0.16, sustain: 0.72, release: 0.32 },
    filter: { frequency: 1900, Q: 5 },
    filterEnvelope: { attack: 0.01, decay: 0.22, sustain: 0.35, release: 0.3, baseFrequency: 700, octaves: 2.1 },
    volume: -3,
  },
  "pulse-lead": {
    oscillator: { type: "pulse", width: 0.32 },
    envelope: { attack: 0.004, decay: 0.12, sustain: 0.64, release: 0.18 },
    filter: { frequency: 2500, Q: 3.2 },
    filterEnvelope: { attack: 0.005, decay: 0.14, sustain: 0.42, release: 0.18, baseFrequency: 900, octaves: 1.8 },
    volume: -4,
  },
  "fm-bell": {
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 1.4, sustain: 0, release: 1.8 },
    filter: { frequency: 7600, Q: 1.1 },
    filterEnvelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 1.2, baseFrequency: 2600, octaves: 1.7 },
    volume: -5,
  },
  "physical-pluck": {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.38, sustain: 0.04, release: 0.42 },
    filter: { frequency: 3600, Q: 2.4 },
    filterEnvelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.3, baseFrequency: 700, octaves: 2.4 },
    volume: -2,
  },
  "glass-pad": {
    oscillator: { type: "fatsine", count: 4, spread: 24 },
    envelope: { attack: 0.85, decay: 0.5, sustain: 0.74, release: 1.8 },
    filter: { frequency: 3400, Q: 1.8 },
    filterEnvelope: { attack: 1.1, decay: 0.6, sustain: 0.55, release: 1.5, baseFrequency: 1100, octaves: 1.4 },
    volume: -7,
  },
  "string-ensemble": {
    oscillator: { type: "fatsawtooth", count: 4, spread: 18 },
    envelope: { attack: 0.42, decay: 0.3, sustain: 0.82, release: 1.35 },
    filter: { frequency: 2100, Q: 0.8 },
    filterEnvelope: { attack: 0.55, decay: 0.4, sustain: 0.65, release: 1.1, baseFrequency: 650, octaves: 1.5 },
    volume: -8,
  },
  "synth-bass": {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.004, decay: 0.3, sustain: 0.5, release: 0.22 },
    filter: { frequency: 620, Q: 4.5 },
    filterEnvelope: { attack: 0.004, decay: 0.24, sustain: 0.18, release: 0.2, baseFrequency: 110, octaves: 3.1 },
    volume: -2,
  },
  "sub-bass": {
    oscillator: { type: "sine" },
    envelope: { attack: 0.008, decay: 0.18, sustain: 0.88, release: 0.28 },
    filter: { frequency: 280, Q: 0.5 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.25, baseFrequency: 80, octaves: 1.1 },
    volume: 0,
  },
  clavinet: {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.002, decay: 0.18, sustain: 0.1, release: 0.15 },
    filter: { frequency: 3200, Q: 6 },
    filterEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.1, baseFrequency: 800, octaves: 2.8 },
    volume: -3,
  },
  "reed-organ": {
    oscillator: { type: "fatsawtooth", count: 2, spread: 7 },
    envelope: { attack: 0.04, decay: 0.1, sustain: 0.88, release: 0.3 },
    filter: { frequency: 2800, Q: 0.5 },
    filterEnvelope: { attack: 0.06, decay: 0.15, sustain: 0.75, release: 0.25, baseFrequency: 900, octaves: 1.0 },
    volume: -6,
  },
  vibraphone: {
    oscillator: { type: "sine" },
    envelope: { attack: 0.002, decay: 0.9, sustain: 0.12, release: 1.4 },
    filter: { frequency: 6400, Q: 1.2 },
    filterEnvelope: { attack: 0.001, decay: 0.7, sustain: 0.05, release: 1.0, baseFrequency: 3200, octaves: 1.2 },
    volume: -4,
  },
  marimba: {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.42, sustain: 0.01, release: 0.55 },
    filter: { frequency: 3800, Q: 0.8 },
    filterEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.4, baseFrequency: 1200, octaves: 2.0 },
    volume: -3,
  },
  brass: {
    oscillator: { type: "fatsawtooth", count: 2, spread: 8 },
    envelope: { attack: 0.08, decay: 0.18, sustain: 0.78, release: 0.22 },
    filter: { frequency: 2600, Q: 3 },
    filterEnvelope: { attack: 0.12, decay: 0.2, sustain: 0.55, release: 0.2, baseFrequency: 400, octaves: 2.4 },
    volume: -5,
  },
  flute: {
    oscillator: { type: "fatsine", count: 2, spread: 5 },
    envelope: { attack: 0.06, decay: 0.1, sustain: 0.82, release: 0.35 },
    filter: { frequency: 4800, Q: 0.6 },
    filterEnvelope: { attack: 0.08, decay: 0.12, sustain: 0.65, release: 0.3, baseFrequency: 1800, octaves: 1.1 },
    volume: -8,
  },
  choir: {
    oscillator: { type: "fatsine", count: 4, spread: 22 },
    envelope: { attack: 0.5, decay: 0.4, sustain: 0.88, release: 1.5 },
    filter: { frequency: 1800, Q: 1.4 },
    filterEnvelope: { attack: 0.6, decay: 0.5, sustain: 0.7, release: 1.2, baseFrequency: 600, octaves: 1.3 },
    volume: -9,
  },
  bells: {
    oscillator: { type: "fatsine", count: 2, spread: 18 },
    envelope: { attack: 0.001, decay: 1.8, sustain: 0, release: 2.2 },
    filter: { frequency: 8000, Q: 1.8 },
    filterEnvelope: { attack: 0.001, decay: 1.4, sustain: 0, release: 1.8, baseFrequency: 3400, octaves: 1.5 },
    volume: -6,
  },
  "warm-strings": {
    oscillator: { type: "fatsawtooth", count: 5, spread: 22 },
    envelope: { attack: 0.35, decay: 0.25, sustain: 0.85, release: 1.1 },
    filter: { frequency: 1600, Q: 0.6 },
    filterEnvelope: { attack: 0.45, decay: 0.3, sustain: 0.68, release: 0.9, baseFrequency: 500, octaves: 1.4 },
    volume: -9,
  },
  "space-pad": {
    oscillator: { type: "fatsine", count: 5, spread: 40 },
    envelope: { attack: 1.2, decay: 0.6, sustain: 0.78, release: 2.5 },
    filter: { frequency: 2200, Q: 2.2 },
    filterEnvelope: { attack: 1.5, decay: 0.8, sustain: 0.6, release: 2.0, baseFrequency: 500, octaves: 1.6 },
    volume: -10,
  },
  "wobble-bass": {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.003, decay: 0.4, sustain: 0.6, release: 0.3 },
    filter: { frequency: 300, Q: 8 },
    filterEnvelope: { attack: 0.01, decay: 0.35, sustain: 0.22, release: 0.28, baseFrequency: 80, octaves: 3.5 },
    volume: -1,
  },
  "acid-bass": {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.002, decay: 0.2, sustain: 0.45, release: 0.18 },
    filter: { frequency: 800, Q: 12 },
    filterEnvelope: { attack: 0.002, decay: 0.18, sustain: 0.15, release: 0.16, baseFrequency: 100, octaves: 4.0 },
    volume: -3,
  },
  // Used as the silent-period fallback while samples are downloading.
  fallback: {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.6 },
    filter: { frequency: 4500, Q: 0.6 },
    filterEnvelope: {
      attack: 0.01, decay: 0.6, sustain: 0, release: 0.4,
      baseFrequency: 4500, octaves: 0.6,
    },
    volume: -10,
  },
  // Bass-specific fallback — sawtooth + heavy low-pass so it sounds bass-like,
  // not piano-like, while the bass-electric samples are downloading.
  bassFallback: {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0.55, release: 0.35 },
    filter: { frequency: 380, Q: 2.5 },
    filterEnvelope: {
      attack: 0.02, decay: 0.25, sustain: 0.2, release: 0.3,
      baseFrequency: 380, octaves: 1.8,
    },
    volume: -6,
  },
};

const requiredSynthConfig = (name: string): SynthPresetOptions => {
  const config = SYNTH_PRESETS[name];
  if (!config) throw new Error(`Missing required synth preset: ${name}`);
  return config;
};

// Free CC-licensed instrument samples, hosted on GitHub Pages.
// https://github.com/nbrosowsky/tonejs-instruments
const SAMPLE_BASE = "https://nbrosowsky.github.io/tonejs-instruments/samples";

interface SamplerPreset {
  folder: string;
  ext: "mp3" | "ogg";
  // sparse set — Tone.Sampler interpolates between these
  urls: Record<string, string>;
  release: number;
  volume: number; // dB
  attack?: number;
}

const SAMPLER_PRESETS: Record<"piano" | "bass" | "guitar", SamplerPreset> = {
  piano: {
    folder: "piano",
    ext: "mp3",
    release: 1.0,
    volume: 0,
    urls: {
      A1: "A1.mp3", C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
      A2: "A2.mp3", C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
      A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
      A4: "A4.mp3", C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
      A5: "A5.mp3", C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
      A6: "A6.mp3", C7: "C7.mp3",
    },
  },
  bass: {
    folder: "bass-electric",
    ext: "mp3",
    release: 0.5,
    volume: 0,
    urls: {
      "A#1": "As1.mp3", "C#2": "Cs2.mp3", E2: "E2.mp3", G2: "G2.mp3",
      "A#2": "As2.mp3", "C#3": "Cs3.mp3", E3: "E3.mp3", G3: "G3.mp3",
      "A#3": "As3.mp3", "C#4": "Cs4.mp3", E4: "E4.mp3", G4: "G4.mp3",
    },
  },
  guitar: {
    folder: "guitar-acoustic",
    ext: "mp3",
    release: 0.6,
    volume: 0,
    urls: {
      E2: "E2.mp3", A2: "A2.mp3", D3: "D3.mp3", G3: "G3.mp3",
      B3: "B3.mp3", E4: "E4.mp3", A4: "A4.mp3", D5: "D5.mp3",
    },
  },
};

const midiToNote = (midi: number): string =>
  Tone.Frequency(midi, "midi").toNote();

function buildSynthOpts(cfg: SynthPresetOptions) {
  return {
    oscillator: cfg.oscillator,
    envelope: cfg.envelope,
    filter: { type: "lowpass" as const, Q: cfg.filter.Q, frequency: cfg.filter.frequency },
    filterEnvelope: cfg.filterEnvelope,
    volume: cfg.volume,
  };
}

type SampleSource = keyof typeof SAMPLER_PRESETS;
const SAMPLE_SOURCE: Partial<Record<SynthPreset, SampleSource>> = {
  piano: "piano",
  "bright-piano": "piano",
  bass: "bass",
  guitar: "guitar",
};

// ── Drum Kit MIDI mapping ──────────────────────────────────────────────────
// General MIDI drum map subset. Each kit flavor has its own tuning/timbre.
const GM_DRUM_MAP: Record<number, string> = {
  35: "kick",  36: "kick",
  38: "snare", 40: "snare",
  42: "hat_closed", 44: "hat_closed", 46: "hat_open",
  49: "crash", 51: "crash",
  41: "tom_lo", 43: "tom_lo", 45: "tom_hi", 47: "tom_hi", 48: "tom_hi",
  37: "rimshot", 39: "clap",
};

type DrumKitVariant = "acoustic" | "electronic" | "808" | "vinyl" | "orchestra";

const DRUM_KIT_VARIANT_MAP: Partial<Record<SynthPreset, DrumKitVariant>> = {
  "drum-kit-acoustic": "acoustic",
  "drum-kit-electronic": "electronic",
  "drum-kit-808": "808",
  "drum-kit-vinyl": "vinyl",
  "drum-kit-orchestra": "orchestra",
};

interface DrumVoiceDef {
  trigger(time: number | undefined, velocity: number): void;
  dispose(): void;
}

function buildDrumKit(variant: DrumKitVariant, destination: Tone.ToneAudioNode): Record<string, DrumVoiceDef> {
  const rnd = (r: number) => (Math.random() * 2 - 1) * r;
  const hVel = (v: number) => Math.max(0.05, Math.min(1, v + rnd(0.06)));

  // Variant-based tuning parameters
  const cfg = {
    acoustic:    { kickFreq: "C1", kickDecay: 0.32, snareDecay: 0.14, hatCutoff: 7000, hatDecay: 0.05, clapDecay: 0.13 },
    electronic:  { kickFreq: "C1", kickDecay: 0.22, snareDecay: 0.1,  hatCutoff: 9000, hatDecay: 0.03, clapDecay: 0.08 },
    "808":       { kickFreq: "B0", kickDecay: 1.20, snareDecay: 0.18, hatCutoff: 8000, hatDecay: 0.04, clapDecay: 0.11 }, // Long decay for authentic 808 boom
    vinyl:       { kickFreq: "C1", kickDecay: 0.28, snareDecay: 0.12, hatCutoff: 6000, hatDecay: 0.06, clapDecay: 0.15 },
    orchestra:   { kickFreq: "F0", kickDecay: 0.55, snareDecay: 0.22, hatCutoff: 5000, hatDecay: 0.08, clapDecay: 0.18 },
  }[variant];

  const kick = new Tone.MembraneSynth({
    pitchDecay: variant === "orchestra" ? 0.12 : 0.05,
    octaves: variant === "808" ? 8 : 6,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: cfg.kickDecay, sustain: 0.01, release: 1.2 },
    volume: -2,
  }).connect(destination);

  const snareHp = new Tone.Filter(variant === "orchestra" ? 400 : 1000, "highpass").connect(destination);
  const snareNoise = new Tone.NoiseSynth({
    noise: { type: variant === "vinyl" ? "pink" : "white" },
    envelope: { attack: 0.001, decay: cfg.snareDecay, sustain: 0 },
    volume: variant === "orchestra" ? -4 : -8,
  }).connect(snareHp);
  const snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.04, octaves: 4,
    envelope: { attack: 0.001, decay: cfg.snareDecay * 0.8, sustain: 0, release: 0.04 },
    volume: -12,
  }).connect(destination);

  const hatHp = new Tone.Filter(cfg.hatCutoff, "highpass").connect(destination);
  const hatClosed = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: cfg.hatDecay, sustain: 0, release: 0.01 },
    volume: 2,
  }).connect(hatHp);

  const hatOpenHp = new Tone.Filter(cfg.hatCutoff * 0.7, "highpass").connect(destination);
  const hatOpen = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.38, sustain: 0.1, release: 0.3 },
    volume: 0,
  }).connect(hatOpenHp);

  const clapHp = new Tone.Filter(800, "highpass").connect(destination);
  const clap = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: cfg.clapDecay, sustain: 0 },
    volume: -2,
  }).connect(clapHp);

  const crash = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.8, sustain: 0.05, release: 1.0 },
    volume: -6,
  }).connect(new Tone.Filter(4000, "highpass").connect(destination));

  const tomHi = new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 3,
    envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.3 },
    volume: -8,
  }).connect(destination);
  const tomLo = new Tone.MembraneSynth({
    pitchDecay: 0.06, octaves: 5,
    envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.5 },
    volume: -6,
  }).connect(destination);
  const rimHp = new Tone.Filter(800, "highpass").connect(destination);
  const rimshot = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    volume: -12,
  }).connect(rimHp);

  return {
    kick:       { trigger(t, v) { kick.triggerAttackRelease(cfg.kickFreq, "8n", t, hVel(v)); }, dispose() { kick.dispose(); } },
    snare:      { trigger(t, v) { const vv = hVel(v); snareNoise.triggerAttackRelease("16n", t, vv); snareBody.triggerAttackRelease("G2", "16n", t, vv * 0.6); }, dispose() { snareNoise.dispose(); snareBody.dispose(); snareHp.dispose(); } },
    hat_closed: { trigger(t, v) { hatClosed.triggerAttackRelease("32n", t, hVel(v)); }, dispose() { hatClosed.dispose(); hatHp.dispose(); } },
    hat_open:   { trigger(t, v) { hatOpen.triggerAttackRelease("8n", t, hVel(v)); }, dispose() { hatOpen.dispose(); hatOpenHp.dispose(); } },
    clap:       { trigger(t, v) { clap.triggerAttackRelease("16n", t, hVel(v)); }, dispose() { clap.dispose(); clapHp.dispose(); } },
    crash:      { trigger(t, v) { crash.triggerAttackRelease("4n", t, hVel(v)); }, dispose() { crash.dispose(); } },
    tom_hi:     { trigger(t, v) { tomHi.triggerAttackRelease("G3", "8n", t, hVel(v)); }, dispose() { tomHi.dispose(); } },
    tom_lo:     { trigger(t, v) { tomLo.triggerAttackRelease("D2", "8n", t, hVel(v)); }, dispose() { tomLo.dispose(); } },
    rimshot:    { trigger(t, v) { rimshot.triggerAttackRelease("32n", t, hVel(v)); }, dispose() { rimshot.dispose(); } },
  };
}

// Decoded sample buffers, cached per source after the first load. A Sampler
// built from cached buffers reports `loaded` synchronously, so freshly-created
// playback/live voices never fall through to the synth fallback.
const sampleBufferCache = new Map<SampleSource, Record<string, Tone.ToneAudioBuffer>>();
let preloadPromise: Promise<void> | null = null;

function getSampler(preset: SampleSource): Tone.Sampler {
  const samplerCfg = SAMPLER_PRESETS[preset];
  // If it's a new preset without sampler configs like "fm-bell", fallback to piano configs for now if not defined or throw an error.
  if(!samplerCfg) throw new Error(`Missing sampler preset for ${preset}`);

  const cached = sampleBufferCache.get(preset);
  if (cached) {
    return new Tone.Sampler({
      urls: cached,
      release: samplerCfg.release,
      attack: samplerCfg.attack ?? 0,
      volume: samplerCfg.volume,
    });
  }

  const baseUrl = `${SAMPLE_BASE}/${samplerCfg.folder}/`;
  return new Tone.Sampler({
    urls: samplerCfg.urls,
    baseUrl,
    release: samplerCfg.release,
    attack: samplerCfg.attack ?? 0,
    volume: samplerCfg.volume,
  });
}

/**
 * Preload (download + decode) the sampled instruments — piano, bass, guitar —
 * into a buffer cache. Call once when the studio opens so that by the time a
 * note is recorded or played back, the correct instrument is ready and notes
 * never briefly sound like the synth fallback. Idempotent.
 */
export function preloadSampledInstruments(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  bindToneToContext();
  preloadPromise = (async () => {
    await Promise.all((Object.keys(SAMPLER_PRESETS) as SampleSource[]).map(async (src) => {
      if (sampleBufferCache.has(src)) return;
      const cfg = SAMPLER_PRESETS[src];
      const baseUrl = `${SAMPLE_BASE}/${cfg.folder}/`;
      const entries = await Promise.all(
        Object.entries(cfg.urls).map(async ([note, file]) => {
          const buffer = new Tone.ToneAudioBuffer();
          await buffer.load(baseUrl + file);
          return [note, buffer] as const;
        }),
      );
      sampleBufferCache.set(src, Object.fromEntries(entries));
    }));
  })();
  return preloadPromise;
}

export class PolySynth {
  private master: Tone.Gain;
  /** Always present — used standalone for lead/pad and as a fallback while samples load. */
  private synth: Tone.PolySynth<Tone.MonoSynth>;
  /** Present only when the active preset is sample-backed. */
  private sampler: Tone.Sampler | null = null;
  private samplerReady = false;
  /** Present when the active preset is a drum-kit variant. */
  private drumKit: Record<string, DrumVoiceDef> | null = null;
  private preset: SynthPreset;
  /** Track which engine handled each note so noteOff goes to the right one. */
  private noteOwner = new Map<number, "synth" | "sampler" | "drum">();
  private active = new Set<number>();
  /** Stored so setFilterFreq can preserve Q when only changing frequency. */
  private filterQ = 1.0;
  /** Sustain pedal state — held notes are queued instead of released immediately. */
  private sustainActive = false;
  private sustainedNotes = new Set<number>();

  constructor(preset: SynthPreset = "piano") {
    bindToneToContext();
    this.preset = preset;

    this.master = new Tone.Gain(1);
    this.master.connect(getMasterBus().input);
    this.synth = new Tone.PolySynth(Tone.MonoSynth, buildSynthOpts(requiredSynthConfig("fallback")))
      .connect(this.master);
    this.synth.maxPolyphony = 16;

    this.applyPreset(preset);
  }

  private applyPreset(p: SynthPreset): void {
    // Drum kit variants
    const drumVariant = DRUM_KIT_VARIANT_MAP[p];
    if (drumVariant !== undefined) {
      this.detachSampler();
      this.detachDrumKit();
      this.drumKit = buildDrumKit(drumVariant, this.master);
      return;
    }

    this.detachDrumKit();
    const synthConfig = SYNTH_PRESETS[p];
    if (synthConfig) {
      this.detachSampler();
      this.filterQ = synthConfig.filter.Q;
      this.synth.set(buildSynthOpts(synthConfig));
      return;
    }

    // Sample-backed presets use an instance-owned sampler. Region playback can
    // then be disposed independently without cutting notes on another track.
    this.detachSampler();
    const sampleSource = SAMPLE_SOURCE[p] ?? "piano";
    const s = getSampler(sampleSource);
    s.connect(this.master);
    this.sampler = s;
    this.samplerReady = s.loaded;

    // While we wait for samples, use a preset-appropriate fallback so bass
    // doesn't sound like piano during the download window.
    const fallbackCfg = requiredSynthConfig(p === "bass" ? "bassFallback" : "fallback");
    this.synth.set(buildSynthOpts(fallbackCfg));

    if (!s.loaded) {
      // Tone.loaded() resolves once every pending buffer in the global
      // registry is downloaded — including this Sampler's URLs.
      Tone.loaded().then(() => {
        // Make sure the user didn't switch presets during the download.
        if (this.sampler === s) this.samplerReady = true;
      });
    }
  }

  private detachSampler(): void {
    if (this.sampler) {
      try { this.sampler.disconnect(this.master); } catch { /* */ }
      this.sampler.dispose();
      this.sampler = null;
    }
    this.samplerReady = false;
  }

  private detachDrumKit(): void {
    if (this.drumKit) {
      for (const v of Object.values(this.drumKit)) v.dispose();
      this.drumKit = null;
    }
  }

  setPreset(p: SynthPreset): void {
    if (p === this.preset) return;
    this.allNotesOff();
    this.preset = p;
    this.applyPreset(p);
  }

  setMasterGainDb(db: number): void {
    const linear = Math.pow(10, db / 20);
    this.master.gain.rampTo(linear, 0.02);
  }

  noteOn(midi: number, velocity = 1): void {
    if (this.active.has(midi)) this.noteOff(midi);
    const liveTime = Tone.immediate();
    // Drum kit: map MIDI note to the appropriate drum voice and trigger immediately.
    if (this.drumKit) {
      const voiceName = GM_DRUM_MAP[midi] ?? this.midiToDrumFallback(midi);
      const voice = this.drumKit[voiceName];
      if (voice) {
        voice.trigger(liveTime, velocity);
        this.noteOwner.set(midi, "drum");
        this.active.add(midi);
      }
      return;
    }
    const note = midiToNote(midi);
    // Self-heal: if the Tone.loaded() callback was missed, check directly.
    if (this.sampler && !this.samplerReady && this.sampler.loaded) {
      this.samplerReady = true;
    }
    if (this.sampler && this.samplerReady) {
      this.sampler.triggerAttack(note, liveTime, velocity);
      this.noteOwner.set(midi, "sampler");
    } else {
      this.synth.triggerAttack(note, liveTime, velocity);
      this.noteOwner.set(midi, "synth");
    }
    this.active.add(midi);
  }

  /** Fallback: map unmapped MIDI notes to the nearest drum sound by proximity. */
  private midiToDrumFallback(midi: number): string {
    const keys = Object.keys(GM_DRUM_MAP).map(Number);
    const firstKey = keys[0];
    if (firstKey === undefined) return "kick";
    const nearest = keys.reduce((best, k) => Math.abs(k - midi) < Math.abs(best - midi) ? k : best, firstKey);
    return GM_DRUM_MAP[nearest] ?? "kick";
  }

  scheduleNote(midi: number, velocity: number, atTime: number, duration: number): void {
    // Drum kit: route to the drum voice, ignoring duration (drums self-release).
    if (this.drumKit) {
      const voiceName = GM_DRUM_MAP[midi] ?? this.midiToDrumFallback(midi);
      this.drumKit[voiceName]?.trigger(atTime, velocity);
      return;
    }
    const note = midiToNote(midi);
    const safeDuration = Math.max(0.02, duration);
    if (this.sampler && !this.samplerReady && this.sampler.loaded) {
      this.samplerReady = true;
    }
    if (this.sampler && this.samplerReady) {
      this.sampler.triggerAttackRelease(note, safeDuration, atTime, velocity);
    } else {
      this.synth.triggerAttackRelease(note, safeDuration, atTime, velocity);
    }
  }

  noteOff(midi: number): void {
    if (!this.active.has(midi)) return;
    if (this.sustainActive) {
      this.sustainedNotes.add(midi);
      return;
    }
    this._releaseNote(midi);
  }

  private _releaseNote(midi: number): void {
    const owner = this.noteOwner.get(midi);
    if (owner === "drum") {
      // Drums self-release; nothing to do here. Just clean up tracking.
    } else if (owner === "sampler" && this.sampler) {
      this.sampler.triggerRelease(midiToNote(midi), Tone.immediate());
    } else {
      this.synth.triggerRelease(midiToNote(midi), Tone.immediate());
    }
    this.active.delete(midi);
    this.noteOwner.delete(midi);
  }

  setSustain(active: boolean): void {
    this.sustainActive = active;
    if (!active) {
      for (const midi of this.sustainedNotes) this._releaseNote(midi);
      this.sustainedNotes.clear();
    }
  }

  setPitchBend(semitones: number): void {
    // Tone.js Sampler has no global detune — pitch bend only applies to synth presets
    this.synth.set({ detune: semitones * 100 });
  }

  allNotesOff(): void {
    this.synth.releaseAll();
    this.sampler?.releaseAll();
    this.active.clear();
    this.noteOwner.clear();
    this.sustainedNotes.clear();
    this.sustainActive = false;
  }

  /** Live-tweak ADSR envelope — only effective for lead/pad presets. */
  setEnvelope(attack: number, decay: number, sustain: number, release: number): void {
    if (!SYNTH_PRESETS[this.preset]) return;
    this.synth.set({
      envelope: { attack, decay, sustain, release },
      filterEnvelope: { attack: attack * 0.9, decay, sustain, release: release * 0.85 },
    });
  }

  /** Live-tweak filter cutoff — only effective for lead/pad presets. */
  setFilterFreq(freq: number): void {
    if (!SYNTH_PRESETS[this.preset]) return;
    this.synth.set({ filter: { type: "lowpass" as const, frequency: freq, Q: this.filterQ } });
  }

  dispose(): void {
    this.allNotesOff();
    this.synth.dispose();
    this.detachSampler();
    this.detachDrumKit();
    this.master.dispose();
  }
}
