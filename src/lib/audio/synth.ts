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

import * as Tone from "tone";
import { bindToneToContext } from "./context";
import { getMasterBus } from "./masterBus";

export type SynthPreset =
  | "piano" | "bright-piano"
  | "electric-piano" | "organ"
  | "lead" | "analog-lead" | "pulse-lead" | "fm-bell" | "physical-pluck"
  | "pad" | "glass-pad" | "string-ensemble"
  | "bass" | "synth-bass" | "sub-bass"
  | "guitar";

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

function getSampler(preset: SampleSource): Tone.Sampler {
  const samplerCfg = SAMPLER_PRESETS[preset];
  // If it's a new preset without sampler configs like "fm-bell", fallback to piano configs for now if not defined or throw an error.
  if(!samplerCfg) throw new Error(`Missing sampler preset for ${preset}`);
  
  const baseUrl = `${SAMPLE_BASE}/${samplerCfg.folder}/`;
  return new Tone.Sampler({
    urls: samplerCfg.urls,
    baseUrl,
    release: samplerCfg.release,
    attack: samplerCfg.attack ?? 0,
    volume: samplerCfg.volume,
  });
}

export class PolySynth {
  private master: Tone.Gain;
  /** Always present — used standalone for lead/pad and as a fallback while samples load. */
  private synth: Tone.PolySynth<Tone.MonoSynth>;
  /** Present only when the active preset is sample-backed. */
  private sampler: Tone.Sampler | null = null;
  private samplerReady = false;
  private preset: SynthPreset;
  /** Track which engine handled each note so noteOff goes to the right one. */
  private noteOwner = new Map<number, "synth" | "sampler">();
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
    this.synth = new Tone.PolySynth(Tone.MonoSynth, buildSynthOpts(SYNTH_PRESETS.fallback!))
      .connect(this.master);
    this.synth.maxPolyphony = 16;

    this.applyPreset(preset);
  }

  private applyPreset(p: SynthPreset): void {
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
    const fallbackCfg = p === "bass" ? SYNTH_PRESETS.bassFallback! : SYNTH_PRESETS.fallback!;
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
    const note = midiToNote(midi);
    // Self-heal: if the Tone.loaded() callback was missed, check directly.
    if (this.sampler && !this.samplerReady && this.sampler.loaded) {
      this.samplerReady = true;
    }
    if (this.sampler && this.samplerReady) {
      this.sampler.triggerAttack(note, undefined, velocity);
      this.noteOwner.set(midi, "sampler");
    } else {
      this.synth.triggerAttack(note, undefined, velocity);
      this.noteOwner.set(midi, "synth");
    }
    this.active.add(midi);
  }

  scheduleNote(midi: number, velocity: number, atTime: number, duration: number): void {
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
    const note = midiToNote(midi);
    const owner = this.noteOwner.get(midi);
    if (owner === "sampler" && this.sampler) {
      this.sampler.triggerRelease(note);
    } else {
      this.synth.triggerRelease(note);
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
    this.master.dispose();
  }
}
