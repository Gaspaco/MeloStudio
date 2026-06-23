// `useSynth` acts as the bridge connecting physical computer keyboard inputs,
// on-screen MIDI piano keys, and the DAW's `PolySynth` Web Audio engine. 
// It handles real-time Web Audio voice generation when typing e.g. "zxcv", 
// converting QWERTY scan codes straight into MIDI note numbers.
// Crucially, it manages the Set of active pressed keys (`activeNotes`) to light up 
// the UI keyboard accurately, and prevents rapid-fire key repeat events making the synth glitch.
import { createEffect, onMount, onCleanup } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { unlockAudioContext } from "~/lib/audio/context";
import { MidiManager } from "~/lib/audio/midiManager";
import { PolySynth, type SynthPreset } from "~/lib/audio/synth";
import { PRESET_ADSR } from "../types";
import type { UITrack } from "../types";

type Deps = {
  tracks: Accessor<UITrack[]>;
  selectedTrack: Accessor<string | null>;
  masterVol: Accessor<number>;
  synthPreset: Accessor<SynthPreset>; setSynthPreset: Setter<SynthPreset>;
  octave: Accessor<number>; setOctave: Setter<number>;
  activeNotes: Accessor<Set<number>>; setActiveNotes: Setter<Set<number>>;
  setSynthAttack: Setter<number>;
  setSynthDecay: Setter<number>;
  setSynthSustain: Setter<number>;
  setSynthRelease: Setter<number>;
  setSynthFilterFreq: Setter<number>;
  setActivePanel: Setter<"drum" | "keys" | "voice" | null>;
  onMidiNoteOn?: (midi: number, velocity: number) => void;
  onMidiNoteOff?: (midi: number) => void;
};

export function useSynth(deps: Deps) {
  let synth: PolySynth | null = null;
  const heldKeys = new Set<string>();
  let lastSelectedTrack: string | null = null;

  const ensureSynth = (preset: SynthPreset = "piano") => {
    if (!synth) {
      synth = new PolySynth(preset);
      // Apply the selected instrument track's volume if available, otherwise masterVol
      const trackId = deps.selectedTrack();
      const track = deps.tracks().find(t => t.id === trackId);
      const vol = track?.volume ?? deps.masterVol();
      const db = vol <= 0.001 ? -60 : 20 * Math.log10(vol);
      synth.setMasterGainDb(db);
    } else {
      synth.setPreset(preset);
    }
    MidiManager.bindTargetSynth(synth);
  };

  const getSynth = () => synth;

  createEffect(() => {
    const trackId = deps.selectedTrack();
    const t = deps.tracks().find(tr => tr.id === trackId);
    if (!t) return;
    if (lastSelectedTrack !== trackId) {
      lastSelectedTrack = trackId;
      if (t.type === "bass") {
        const preset = t.instrumentPreset ?? "bass";
        if (deps.synthPreset() !== preset) { deps.setSynthPreset(preset); synth?.setPreset(preset); }
        deps.setOctave(2);
        deps.setActivePanel("keys");
      } else if (t.type === "guitar") {
        const preset = t.instrumentPreset ?? "guitar";
        if (deps.synthPreset() !== preset) { deps.setSynthPreset(preset); synth?.setPreset(preset); }
        deps.setOctave(4);
        deps.setActivePanel("keys");
      } else if (t.type === "instrument") {
        const preset = t.instrumentPreset ?? "piano";
        if (deps.synthPreset() !== preset) {
          deps.setSynthPreset(preset); synth?.setPreset(preset);
        }
        deps.setOctave(4);
        deps.setActivePanel("keys");
      } else if (t.type === "drum") {
        deps.setActivePanel("drum");
      } else {
        deps.setActivePanel(null);
      }
    }
  });

  const KEY_MAP: Record<string, number> = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
    k: 12, o: 13, l: 14, p: 15, ";": 16,
  };

  const onKeyDown = async (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement).isContentEditable
    ) return;
    
    const sel = deps.tracks().find(t => t.id === deps.selectedTrack());
    if (!sel || (sel.type !== "instrument" && sel.type !== "bass" && sel.type !== "guitar")) return;
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "z") { deps.setOctave(Math.max(1, deps.octave() - 1)); return; }
    if (k === "x") { deps.setOctave(Math.min(7, deps.octave() + 1)); return; }
    const keyVal = KEY_MAP[k];
    if (keyVal === undefined) return;
    if (heldKeys.has(k)) return;
    heldKeys.add(k);
    e.preventDefault();
    await unlockAudioContext();
    const activePreset: SynthPreset = sel.type === "bass" ? "bass"
      : sel.type === "guitar" ? "guitar" : (sel.instrumentPreset ?? deps.synthPreset());
    ensureSynth(activePreset);
    if (!synth) return;
    // MIDI note formula: (octave+1)*12 + semitone; the +1 is because MIDI octave 0 starts at note 12, not 0
    const midi = 12 * (deps.octave() + 1) + keyVal;
    synth.noteOn(midi, 0.85);
    deps.onMidiNoteOn?.(midi, 0.85);
    const next = new Set(deps.activeNotes());
    next.add(midi);
    deps.setActiveNotes(next);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const keyVal = KEY_MAP[k];
    if (keyVal === undefined || !heldKeys.has(k)) return;
    heldKeys.delete(k);
    const midi = 12 * (deps.octave() + 1) + keyVal;
    synth?.noteOff(midi);
    deps.onMidiNoteOff?.(midi);
    const next = new Set(deps.activeNotes());
    next.delete(midi);
    deps.setActiveNotes(next);
  };

  const pressKey = async (midi: number) => {
    await unlockAudioContext();
    const sel = deps.tracks().find(t => t.id === deps.selectedTrack());
    const activePreset: SynthPreset = sel?.type === "bass" ? "bass"
      : sel?.type === "guitar" ? "guitar" : (sel?.instrumentPreset ?? deps.synthPreset());
    ensureSynth(activePreset);
    if (!synth) return;
    synth.noteOn(midi, 0.85);
    deps.onMidiNoteOn?.(midi, 0.85);
    const next = new Set(deps.activeNotes());
    next.add(midi);
    deps.setActiveNotes(next);
  };

  const releaseKey = (midi: number) => {
    synth?.noteOff(midi);
    deps.onMidiNoteOff?.(midi);
    const next = new Set(deps.activeNotes());
    next.delete(midi);
    deps.setActiveNotes(next);
  };

  const updatePreset = (p: SynthPreset) => {
    deps.setSynthPreset(p);
    if (synth) synth.setPreset(p);
    if (p === "lead" || p === "pad") {
      const d = PRESET_ADSR[p];
      deps.setSynthAttack(d.attack); deps.setSynthDecay(d.decay);
      deps.setSynthSustain(d.sustain); deps.setSynthRelease(d.release);
      deps.setSynthFilterFreq(d.filterFreq);
    }
    if (p === "bass") deps.setOctave(2);
    else if (p !== deps.synthPreset()) deps.setOctave(4);
  };

  const updateEnvelope = (a: number, d: number, s: number, r: number) => {
    deps.setSynthAttack(a); deps.setSynthDecay(d);
    deps.setSynthSustain(s); deps.setSynthRelease(r);
    synth?.setEnvelope(a, d, s, r);
  };

  const updateFilterFreq = (freq: number) => {
    deps.setSynthFilterFreq(freq);
    synth?.setFilterFreq(freq);
  };

  const allNotesOff = () => synth?.allNotesOff();

  onMount(() => {
    void MidiManager.initialize().then(() => MidiManager.bindTargetSynth(synth));
    MidiManager.bindNoteListener((event) => {
      if (event.type === "on") deps.onMidiNoteOn?.(event.midi, event.velocity);
      else deps.onMidiNoteOff?.(event.midi);
    });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
  });

  onCleanup(() => {
    synth?.allNotesOff();
    MidiManager.bindTargetSynth(null);
    MidiManager.bindNoteListener(null);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  });

  return { getSynth, ensureSynth, pressKey, releaseKey, updatePreset, updateEnvelope, updateFilterFreq, allNotesOff };
}
