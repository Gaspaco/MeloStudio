// Polyphonic subtractive synth with 3 presets.
// Each voice: 2 oscillators -> filter -> ADSR amp env -> master.

import { getAudioContext } from "./context";

export type SynthPreset = "piano" | "lead" | "pad" | "bass";

interface PresetConfig {
  osc1: OscillatorType;
  osc2: OscillatorType;
  detune: number;       // cents on osc2
  filterFreq: number;   // base Hz
  filterQ: number;
  amp: { a: number; d: number; s: number; r: number };
  filt: { a: number; d: number; s: number; r: number; mod: number };
  gain: number;
}

const PRESETS: Record<SynthPreset, PresetConfig> = {
  piano: {
    osc1: "triangle", osc2: "sine", detune: 4,
    filterFreq: 4500, filterQ: 0.6,
    amp:  { a: 0.005, d: 0.4, s: 0.0, r: 0.6 },
    filt: { a: 0.01,  d: 0.6, s: 0.0, r: 0.4, mod: 2500 },
    gain: 0.45,
  },
  lead: {
    osc1: "sawtooth", osc2: "sawtooth", detune: 8,
    filterFreq: 1500, filterQ: 4,
    amp:  { a: 0.005, d: 0.2, s: 0.7, r: 0.25 },
    filt: { a: 0.01,  d: 0.3, s: 0.4, r: 0.25, mod: 3500 },
    gain: 0.3,
  },
  pad: {
    osc1: "sawtooth", osc2: "triangle", detune: 12,
    filterFreq: 800, filterQ: 1.2,
    amp:  { a: 0.6, d: 0.3, s: 0.8, r: 1.2 },
    filt: { a: 0.8, d: 0.4, s: 0.6, r: 1.0, mod: 1200 },
    gain: 0.32,
  },
  bass: {
    osc1: "square", osc2: "sawtooth", detune: -12,
    filterFreq: 600, filterQ: 6,
    amp:  { a: 0.005, d: 0.2, s: 0.6, r: 0.2 },
    filt: { a: 0.005, d: 0.25, s: 0.3, r: 0.2, mod: 1500 },
    gain: 0.5,
  },
};

const noteToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

interface Voice {
  o1: OscillatorNode;
  o2: OscillatorNode;
  filter: BiquadFilterNode;
  amp: GainNode;
}

export class PolySynth {
  private cfg: PresetConfig;
  private master: GainNode;
  private active = new Map<number, Voice>(); // midi -> voice

  constructor(preset: SynthPreset = "piano") {
    this.cfg = PRESETS[preset];
    const ctx = getAudioContext();
    this.master = ctx.createGain();
    this.master.gain.value = this.cfg.gain;
    this.master.connect(ctx.destination);
  }

  setPreset(p: SynthPreset): void {
    this.cfg = PRESETS[p];
    const ctx = getAudioContext();
    this.master.gain.setTargetAtTime(this.cfg.gain, ctx.currentTime, 0.02);
  }

  setMasterGainDb(db: number): void {
    const ctx = getAudioContext();
    const g = Math.max(0.0001, Math.pow(10, db / 20)) * this.cfg.gain;
    this.master.gain.setTargetAtTime(g, ctx.currentTime, 0.02);
  }

  noteOn(midi: number, velocity = 1): void {
    if (this.active.has(midi)) this.noteOff(midi);
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const f = noteToFreq(midi);

    const o1 = ctx.createOscillator();
    o1.type = this.cfg.osc1;
    o1.frequency.value = f;

    const o2 = ctx.createOscillator();
    o2.type = this.cfg.osc2;
    o2.frequency.value = f;
    o2.detune.value = this.cfg.detune;

    const mix = ctx.createGain();
    mix.gain.value = 0.5;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = this.cfg.filterQ;
    const fStart = this.cfg.filterFreq;
    const fPeak = fStart + this.cfg.filt.mod;
    filter.frequency.setValueAtTime(fStart, t);
    filter.frequency.linearRampToValueAtTime(fPeak, t + this.cfg.filt.a);
    filter.frequency.linearRampToValueAtTime(
      fStart + (fPeak - fStart) * this.cfg.filt.s,
      t + this.cfg.filt.a + this.cfg.filt.d
    );

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(velocity, t + this.cfg.amp.a);
    amp.gain.linearRampToValueAtTime(velocity * this.cfg.amp.s, t + this.cfg.amp.a + this.cfg.amp.d);

    o1.connect(mix);
    o2.connect(mix);
    mix.connect(filter).connect(amp).connect(this.master);

    o1.start(t);
    o2.start(t);

    this.active.set(midi, { o1, o2, filter, amp });
  }

  noteOff(midi: number): void {
    const v = this.active.get(midi);
    if (!v) return;
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const r = this.cfg.amp.r;
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setValueAtTime(v.amp.gain.value, t);
    v.amp.gain.linearRampToValueAtTime(0, t + r);
    const filterEnd = this.cfg.filterFreq;
    v.filter.frequency.cancelScheduledValues(t);
    v.filter.frequency.setValueAtTime(v.filter.frequency.value, t);
    v.filter.frequency.linearRampToValueAtTime(filterEnd, t + this.cfg.filt.r);
    v.o1.stop(t + r + 0.05);
    v.o2.stop(t + r + 0.05);
    const stopAt = t + r + 0.1;
    setTimeout(() => {
      try { v.o1.disconnect(); v.o2.disconnect(); v.filter.disconnect(); v.amp.disconnect(); } catch { /* */ }
    }, (stopAt - t) * 1000 + 50);
    this.active.delete(midi);
  }

  allNotesOff(): void {
    for (const m of [...this.active.keys()]) this.noteOff(m);
  }
}
