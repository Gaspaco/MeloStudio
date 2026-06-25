// `useSynth` acts as the bridge connecting physical computer keyboard inputs,
// on-screen MIDI piano keys, and the DAW's `PolySynth` Web Audio engine. 
// It handles real-time Web Audio voice generation when typing e.g. "zxcv", 
// converting QWERTY scan codes straight into MIDI note numbers.
// Crucially, it manages the Set of active pressed keys (`activeNotes`) to light up 
// the UI keyboard accurately, and prevents rapid-fire key repeat events making the synth glitch.
import { createEffect, onMount, onCleanup } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { unlockAudioContext, isAudioContextReady } from "~/lib/audio/context";
import { MidiManager } from "~/lib/audio/midiManager";
import { PolySynth, type SynthPreset } from "~/lib/audio/synth";
import { PRESET_ADSR } from "../types";
import type { UITrack } from "../types";

type Deps = {
  tracks: Accessor<UITrack[]>;
  selectedTrack: Accessor<string | null>;
  midiArmedTrackId: Accessor<string | null>;
  midiInputEnabled: Accessor<boolean>;
  /** When true (count-in active), all MIDI and keyboard note input is blocked. */
  countingIn?: Accessor<boolean>;
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
  onMidiNoteOn?: (midi: number, velocity: number, receivedAt: number) => void;
  onMidiNoteOff?: (midi: number, receivedAt: number) => void;
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
  };

  const getSynth = () => synth;

  createEffect(() => {
    const trackId = deps.selectedTrack();
    const t = deps.tracks().find(tr => tr.id === trackId);
    if (!t) lastSelectedTrack = null;
    if (t && lastSelectedTrack !== trackId) {
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
        deps.setOctave(preset.startsWith("drum-kit") ? 2 : 4);
        deps.setActivePanel("keys");
      } else if (t.type === "drum") {
        deps.setActivePanel("drum");
      } else {
        deps.setActivePanel(null);
      }
    }

    const armedTrack = deps.tracks().find(track =>
      track.id === deps.midiArmedTrackId() || track.recordArmed
    );
    const selectedInstrument = t && (t.type === "instrument" || t.type === "bass" || t.type === "guitar") ? t : null;
    const armedInstrument = armedTrack && (armedTrack.type === "instrument" || armedTrack.type === "bass" || armedTrack.type === "guitar")
      ? armedTrack
      : null;
    const target = armedInstrument ?? selectedInstrument;
    MidiManager.setEnabled(deps.midiInputEnabled());
    if (!deps.midiInputEnabled() || !target) {
      synth?.allNotesOff();
      MidiManager.bindTargetSynth(null);
      deps.setActiveNotes(new Set<number>());
      return;
    }
    const preset = target.type === "bass"
      ? (target.instrumentPreset ?? "bass")
      : target.type === "guitar"
        ? (target.instrumentPreset ?? "guitar")
        : (target.instrumentPreset ?? deps.synthPreset());
    ensureSynth(preset);
    const volume = target.volume ?? deps.masterVol();
    synth?.setMasterGainDb(volume <= 0.001 ? -60 : 20 * Math.log10(volume));
    MidiManager.bindTargetSynth(synth);
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
    // Once the context is warm, trigger synchronously — awaiting the unlock path
    // on every keypress adds latency to live playing.
    if (!isAudioContextReady()) await unlockAudioContext();
    const activePreset: SynthPreset = sel.instrumentPreset
      ?? (sel.type === "bass" ? "bass" : sel.type === "guitar" ? "guitar" : deps.synthPreset());
    ensureSynth(activePreset);
    if (!synth) return;
    
    // Bypass standard pitched-instrument octave logic for drum kits.
    const isDrumKit = activePreset.startsWith("drum-kit");
    const octave = isDrumKit ? 2 : (deps.octave() + 1); // 2 * 12 = 24. Wait, MIDI octave 0 starts at 12? No, ToneJS maps C1 to 36. C0=24, C-1=12. So C1 = 12 * 3.
    // Let's use 36 + keyVal directly to map to C1
    const midi = isDrumKit ? 36 + keyVal : 12 * (deps.octave() + 1) + keyVal;

    synth.noteOn(midi, 0.85);
    deps.onMidiNoteOn?.(midi, 0.85, performance.now());
    const next = new Set(deps.activeNotes());
    next.add(midi);
    deps.setActiveNotes(next);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const keyVal = KEY_MAP[k];
    if (keyVal === undefined || !heldKeys.has(k)) return;
    heldKeys.delete(k);
    
    const sel = deps.tracks().find(t => t.id === deps.selectedTrack());
    const activePreset = sel?.instrumentPreset ?? (sel?.type === "bass" ? "bass" : sel?.type === "guitar" ? "guitar" : deps.synthPreset());
    const isDrumKit = activePreset.startsWith("drum-kit");
    const midi = isDrumKit ? 36 + keyVal : 12 * (deps.octave() + 1) + keyVal;

    synth?.noteOff(midi);
    deps.onMidiNoteOff?.(midi, performance.now());
    const next = new Set(deps.activeNotes());
    next.delete(midi);
    deps.setActiveNotes(next);
  };

  const pressKey = async (midi: number) => {
    if (!isAudioContextReady()) await unlockAudioContext();
    const sel = deps.tracks().find(t => t.id === deps.selectedTrack());
    if (!sel || (sel.type !== "instrument" && sel.type !== "bass" && sel.type !== "guitar")) return;
    const activePreset: SynthPreset = sel.instrumentPreset
      ?? (sel.type === "bass" ? "bass" : sel.type === "guitar" ? "guitar" : deps.synthPreset());
    ensureSynth(activePreset);
    if (!synth) return;
    synth.noteOn(midi, 0.85);
    deps.onMidiNoteOn?.(midi, 0.85, performance.now());
    const next = new Set(deps.activeNotes());
    next.add(midi);
    deps.setActiveNotes(next);
  };

  const releaseKey = (midi: number) => {
    synth?.noteOff(midi);
    deps.onMidiNoteOff?.(midi, performance.now());
    const next = new Set(deps.activeNotes());
    next.delete(midi);
    deps.setActiveNotes(next);
  };

  const updatePreset = (p: SynthPreset) => {
    deps.setSynthPreset(p);
    if (synth) synth.setPreset(p);
    const d = PRESET_ADSR[p as keyof typeof PRESET_ADSR];
    if (d) {
      deps.setSynthAttack(d.attack); deps.setSynthDecay(d.decay);
      deps.setSynthSustain(d.sustain); deps.setSynthRelease(d.release);
      deps.setSynthFilterFreq(d.filterFreq);
    }
    if (p === "bass" || p === "synth-bass" || p === "sub-bass" || p.startsWith("drum-kit")) deps.setOctave(2);
    else deps.setOctave(4);
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
    void MidiManager.initialize();
    MidiManager.bindNoteListener((event) => {
      const next = new Set(deps.activeNotes());
      if (event.type === "on") {
        next.add(event.midi);
        deps.onMidiNoteOn?.(event.midi, event.velocity, event.receivedAt);
      } else {
        next.delete(event.midi);
        deps.onMidiNoteOff?.(event.midi, event.receivedAt);
      }
      deps.setActiveNotes(next);
    });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
  });

  onCleanup(() => {
    synth?.dispose();
    MidiManager.bindTargetSynth(null);
    MidiManager.bindNoteListener(null);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  });

  return { getSynth, ensureSynth, pressKey, releaseKey, updatePreset, updateEnvelope, updateFilterFreq, allNotesOff };
}
