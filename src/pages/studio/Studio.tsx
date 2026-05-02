import { type Component, createSignal, createEffect, onMount, onCleanup, For, Show, createMemo } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { KeyboardMusic, Drum, AudioWaveform, MicVocal, Disc2, Guitar, Music, Video, FileMusic } from "lucide-solid";
import Peaks, { type PeaksInstance } from "peaks.js";
import { authClient } from "~/lib/auth";
import { StepSequencer, DEFAULT_PATTERN, sanitizePattern, type StepPattern } from "~/lib/audio/stepSeq";
import { unlockAudioContext, getAudioContext } from "~/lib/audio/context";
import { storeClip, loadClip, removeClip } from "~/lib/clipStore";
import { PolySynth, type SynthPreset } from "~/lib/audio/synth";
import { updateProjectApi } from "~/lib/api";
import "./studio.scss";

type TrackType = "drum" | "voice" | "instrument" | "sampler" | "bass" | "guitar";

type ClipKind = "audio" | "midi" | "video";
interface MediaClip {
  id: string;
  kind: ClipKind;
  name: string;
  barStart: number; // bar index (0-based)
  bars: number;     // length in bars
  url?: string;     // object URL for audio/video preview (not persisted)
}

interface UITrack {
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

const TRACK_DEFS: { type: TrackType; label: string; sub?: string; tag: string; ready: boolean; icon: string; color: string }[] = [
  { type: "instrument", label: "Instrument",   sub: "Piano, lead, pad, plucks — playable from your keyboard",   tag: "MIDI",     ready: true,  icon: "instrument", color: "#3ee08b" },
  { type: "drum",       label: "Drum Machine", sub: "Step-sequenced kit · ready in seconds",                    tag: "RHYTHM",   ready: true,  icon: "drum",       color: "#f5b53e" },
  { type: "bass",       label: "Bass Synth",   sub: "Deep monophonic bass — keyboard playable",                 tag: "MIDI",     ready: true,  icon: "bass",       color: "#1d87f5" },
  { type: "voice",      label: "Voice / Audio",sub: "Capture vocals or any external sound source",              tag: "AUDIO",    ready: false, icon: "voice",      color: "#f53e3e" },
  { type: "sampler",    label: "Sampler",      sub: "Turn any audio clip into a playable instrument",           tag: "MIDI",     ready: false, icon: "sampler",    color: "#a93ef5" },
  { type: "guitar",     label: "Guitar",       sub: "Acoustic & Electric Guitars — keyboard playable",          tag: "MIDI",     ready: true,  icon: "guitar",     color: "#f53ee0" },
];

const DRUM_LABEL: Record<string, string> = {
  kick: "Kick", snare: "Snare", hat_closed: "Hi-Hat", hat_open: "Open Hat",
  clap: "Clap", tom_hi: "Tom Hi", tom_lo: "Tom Lo", rimshot: "Rimshot",
};

const fmtTime = (sec: number): string => {
  if (sec < 0 || !isFinite(sec)) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
};

/* Track icons — lucide-solid */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRACK_ICON_MAP: Record<string, Component<any>> = {
  instrument: KeyboardMusic,
  drum:       Drum,
  bass:       AudioWaveform,
  voice:      MicVocal,
  sampler:    Disc2,
  guitar:     Guitar,
};

const TrackIcon: Component<{ name: string }> = (props) => {
  const Icon = TRACK_ICON_MAP[props.name];
  return Icon ? <Icon size={18} stroke-width={1.4} aria-hidden="true" /> : null;
};

const MEDIA_ICON_MAP: Record<string, Component<any>> = {
  audio: MicVocal,
  midi:  FileMusic,
  video: MicVocal,
};
const MediaClipIcon: Component<{ kind: string }> = (props) => {
  const Icon = MEDIA_ICON_MAP[props.kind];
  return Icon ? <Icon size={11} stroke-width={1.6} aria-hidden="true" /> : null;
};

// Reusable SVG Waveform component drawn from an object URL's ArrayBuffer
const AudioWaveformDisplay: Component<{ url?: string; color: string }> = (props) => {
  let containerEl!: HTMLDivElement;
  let audioEl!: HTMLAudioElement;
  let peaksInstance: PeaksInstance | null = null;

  const initPeaks = (url: string) => {
    if (peaksInstance) { peaksInstance.destroy(); peaksInstance = null; }
    if (!containerEl || !audioEl) return;
    audioEl.src = url;
    Peaks.init({
      overview: {
        container: containerEl,
        waveformColor: props.color,
        showAxisLabels: false,
        playheadColor: "transparent",
        playheadTextColor: "transparent",
        axisGridlineColor: "transparent",
        highlightColor: "transparent",
        highlightOpacity: 0,
      },
      mediaElement: audioEl,
      webAudio: { audioContext: new AudioContext() },
      keyboard: false,
      logger: console.debug.bind(console),
    }, (err, peaks) => {
      if (err || !peaks) return;
      peaksInstance = peaks;
      const view = peaks.views.getView("overview");
      if (view) {
        view.enableSeek(false);
        view.showAxisLabels(false, { topMarkerHeight: 0, bottomMarkerHeight: 0 });
        view.setAmplitudeScale(1.0);
      }
    });
  };

  createEffect(() => {
    const url = props.url;
    if (url) initPeaks(url);
  });

  onCleanup(() => {
    if (peaksInstance) { peaksInstance.destroy(); peaksInstance = null; }
  });

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <audio ref={audioEl!} style={{ display: "none" }} preload="metadata" />
      <div ref={containerEl!} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

const PRESET_ADSR = {
  lead: { attack: 0.005, decay: 0.2,  sustain: 0.7, release: 0.25, filterFreq: 1500 },
  pad:  { attack: 0.6,   decay: 0.3,  sustain: 0.8, release: 1.2,  filterFreq: 800  },
} as const;

// Curated palette for newly imported tracks — handpicked to feel
// like a modern DAW (Ableton/Logic). Picked at random per track.
const TRACK_COLORS = [
  "#3ee08b", // mint
  "#1d87f5", // azure
  "#f5b53e", // amber
  "#a93ef5", // violet
  "#3eddf5", // cyan
  "#f53e8a", // hot pink
  "#9af53e", // lime
  "#f57c3e", // orange
  "#3ef5d4", // turquoise
  "#cf5cf5", // magenta
  "#5cf593", // jade
  "#f5e23e", // yellow
];
const randomTrackColor = (avoid?: string): string => {
  const pool = avoid ? TRACK_COLORS.filter(c => c !== avoid) : TRACK_COLORS;
  return pool[Math.floor(Math.random() * pool.length)] ?? TRACK_COLORS[0]!;
};

const Studio: Component = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  let seq: StepSequencer | null = null;
  let synth: PolySynth | null = null;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  const heldKeys = new Set<string>();
  let importInputEl: HTMLInputElement | undefined;

  // ── Audio clip playback ──────────────────────────────────────────────────
  let audioSources: AudioBufferSourceNode[] = [];
  let playbackRaf: number | null = null;
  let playbackStartCtxTime = 0;
  let playbackStartTimelineSecs = 0;
  const audioBufferCache = new Map<string, AudioBuffer>();
  // Shared master gain node — all clip sources route through this so the
  // master volume fader affects clips that are already playing.
  let masterGainNode: GainNode | null = null;

  const barsToSecs = (bars: number) => bars * 4 * (60 / bpm());
  const pxToSecs   = (px: number)   => (px / 80) * 4 * (60 / bpm());
  const secsToPx   = (secs: number) => secs * (bpm() / 60) * (80 / 4);

  const stopAudioPlayback = () => {
    for (const src of audioSources) { try { src.stop(); } catch { /* already ended */ } }
    audioSources = [];
    if (playbackRaf) { cancelAnimationFrame(playbackRaf); playbackRaf = null; }
    // Disconnect master gain node so it can be re-created cleanly next play
    if (masterGainNode) { try { masterGainNode.disconnect(); } catch { /* */ } masterGainNode = null; }
  };

  const startAudioPlayback = async () => {
    stopAudioPlayback();
    const ctx = getAudioContext();
    const timelineStartSecs = pxToSecs(playheadPx());
    playbackStartCtxTime    = ctx.currentTime;
    playbackStartTimelineSecs = timelineStartSecs;

    const tickPlayhead = () => {
      const elapsed = getAudioContext().currentTime - playbackStartCtxTime;
      setPlayheadPx(secsToPx(playbackStartTimelineSecs + elapsed));
      playbackRaf = requestAnimationFrame(tickPlayhead);
    };
    playbackRaf = requestAnimationFrame(tickPlayhead);

    // One shared gain node for all clips — lets us update volume live
    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = masterVol();
    masterGainNode.connect(ctx.destination);

    for (const track of tracks()) {
      for (const clip of track.clips ?? []) {
        if (clip.kind === "midi" || !clip.url) continue;
        let buffer = audioBufferCache.get(clip.url);
        if (!buffer) {
          try {
            const ab = await fetch(clip.url).then(r => r.arrayBuffer());
            buffer = await ctx.decodeAudioData(ab);
            audioBufferCache.set(clip.url, buffer);
          } catch { continue; }
        }
        const clipStartSecs = barsToSecs(clip.barStart);
        const clipEndSecs   = clipStartSecs + barsToSecs(clip.bars);
        if (clipEndSecs <= timelineStartSecs) continue; // already passed
        const offsetInClip = Math.max(0, timelineStartSecs - clipStartSecs);
        const delayFromNow = Math.max(0, clipStartSecs - timelineStartSecs);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(masterGainNode!);
        src.start(ctx.currentTime + delayFromNow, offsetInClip);
        audioSources.push(src);
      }
    }
  };

  const [name, setName] = createSignal("New Project");
  const [tracks, setTracks] = createSignal<UITrack[]>([]);
  const [selectedTrack, setSelectedTrack] = createSignal<string | null>(null);
  const [pattern, setPattern] = createSignal<StepPattern>(DEFAULT_PATTERN());
  const [bpm, setBpm] = createSignal(100);
  const [playing, setPlaying] = createSignal(false);
  const [currentStep, setCurrentStep] = createSignal(-1);
  const [elapsed, setElapsed] = createSignal(0);
  const [masterVol, setMasterVol] = createSignal(0.8); // 0..1
  const [saveState, setSaveState] = createSignal<"idle" | "saving" | "saved">("idle");
  const [error, setError] = createSignal("");
  const [showNewTrack, setShowNewTrack] = createSignal(false);
  const [showAddMenu, setShowAddMenu] = createSignal(false);
  const [showRestoreDialog, setShowRestoreDialog] = createSignal(false);
  // Holds the raw server doc while the user decides whether to restore
  let pendingDoc: any = null;
  const [navOpen, setNavOpen] = createSignal(false);
  const [navCat, setNavCat] = createSignal<"project" | "edit" | "insert" | "view" | "transport" | "help">("project");
  const [titleEditing, setTitleEditing] = createSignal(false);
  let titleInputEl: HTMLInputElement | undefined;
  const [drumPanelOpen, setDrumPanelOpen] = createSignal(true);
  // "drum" | "keys" | null  — controls which bottom panel is visible
  const [activePanel, setActivePanel] = createSignal<"drum" | "keys" | null>(null);
  const [drumSwing, setDrumSwing] = createSignal(0);
  const [drumSteps, setDrumSteps] = createSignal(16);
  const [synthPreset, setSynthPreset] = createSignal<SynthPreset>("piano");
  const [octave, setOctave] = createSignal(4);
  // Synth editor params (ADSR + filter) — active when Lead or Pad is selected
  const [synthAttack,     setSynthAttack]     = createSignal<number>(PRESET_ADSR.lead.attack);
  const [synthDecay,      setSynthDecay]      = createSignal<number>(PRESET_ADSR.lead.decay);
  const [synthSustain,    setSynthSustain]    = createSignal<number>(PRESET_ADSR.lead.sustain);
  const [synthRelease,    setSynthRelease]    = createSignal<number>(PRESET_ADSR.lead.release);
  const [synthFilterFreq, setSynthFilterFreq] = createSignal<number>(PRESET_ADSR.lead.filterFreq);

  // Sync the synth preset whenever the selected track changes.
  // Bass tracks always use the "bass" preset; switching back to an
  // instrument track restores a non-bass preset.
  let lastSelectedTrack: string | null = null;
  createEffect(() => {
    const trackId = selectedTrack();
    const t = tracks().find(tr => tr.id === trackId);
    if (!t) return;
    
    if (lastSelectedTrack !== trackId) {
      lastSelectedTrack = trackId;
      if (t.type === "bass") {
        if (synthPreset() !== "bass") {
          setSynthPreset("bass");
          synth?.setPreset("bass");
        }
        setOctave(2);
        setActivePanel("keys");
      } else if (t.type === "guitar") {
        if (synthPreset() !== "guitar") {
          setSynthPreset("guitar");
          synth?.setPreset("guitar");
        }
        setOctave(4);
        setActivePanel("keys");
      } else if (t.type === "instrument") {
        if (synthPreset() === "bass" || synthPreset() === "guitar") {
          setSynthPreset("piano");
          synth?.setPreset("piano");
        }
        setOctave(4);
        setActivePanel("keys");
      } else if (t.type === "drum") {
        setActivePanel("drum");
      } else {
        setActivePanel(null);
      }
    }
  });
  const [activeNotes, setActiveNotes] = createSignal<Set<number>>(new Set());

  const userId = async (): Promise<string | null> => {
    const { data } = await authClient.getSession();
    return data?.user?.id ?? null;
  };

  // ── Restore helpers ─────────────────────────────────────────────────────
  const applyDoc = async (doc: any) => {
    setName(doc.name ?? "Untitled");
    if (doc.transport?.bpm) setBpm(doc.transport.bpm);

    const pat: StepPattern | undefined = doc.beat?.pattern;
    if (pat?.rows?.length) {
      const cleanPat = sanitizePattern(pat);
      setPattern(cleanPat);
      seq!.setPattern(cleanPat);
      if (cleanPat.bpm) setBpm(cleanPat.bpm);
    }

    const savedTracks: UITrack[] | undefined = doc.uiTracks;
    if (savedTracks?.length) {
      const restoredTracks: UITrack[] = [];
      for (const t of savedTracks) {
        if (!TRACK_DEFS.find(d => d.type === t.type)) continue;
        const restoredClips: MediaClip[] = [];
        for (const clip of t.clips ?? []) {
          if (clip.kind !== "midi") {
            const url = await loadClip(clip.id).catch(() => null);
            restoredClips.push({ ...clip, url: url ?? undefined });
          } else {
            restoredClips.push(clip);
          }
        }
        restoredTracks.push({ ...t, clips: restoredClips });
        if (t.type === "instrument" || t.type === "bass" || t.type === "guitar") {
          const preset = t.type === "bass" ? "bass" : t.type === "guitar" ? "guitar" : synthPreset();
          if (!synth) { synth = new PolySynth(preset); } else { synth.setPreset(preset); }
          if (t.type === "bass") setSynthPreset("bass");
          else if (t.type === "guitar") setSynthPreset("guitar");
        }
      }
      setTracks(restoredTracks);
      setSelectedTrack(restoredTracks[0]?.id ?? null);
      const hasDrum = restoredTracks.some(t => t.type === "drum");
      if (hasDrum && pat?.rows?.length) seq!.setPattern(sanitizePattern(pat));
      if (hasDrum) setDrumPanelOpen(true);
    }
  };

  const restoreSession = async () => {
    setShowRestoreDialog(false);
    if (pendingDoc) await applyDoc(pendingDoc);
    pendingDoc = null;
  };

  const discardSession = async () => {
    setShowRestoreDialog(false);
    if (!pendingDoc) { pendingDoc = null; return; }
    // Wipe all clip blobs from IDB for this doc
    for (const t of (pendingDoc.uiTracks ?? []) as UITrack[]) {
      for (const clip of t.clips ?? []) {
        removeClip(clip.id).catch(() => {});
      }
    }
    // Save the cleared state back to server
    pendingDoc = null;
    const id = await userId().catch(() => null);
    if (!id) return;
    const res = await fetch(`/api/projects/${params.id}`, { headers: { "x-user-id": id } });
    if (!res.ok) return;
    const doc = await res.json();
    await fetch(`/api/projects/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-user-id": id },
      body: JSON.stringify({ ...doc, uiTracks: [], beat: { pattern: DEFAULT_PATTERN() } }),
    });
    // Open the track picker so the user can immediately pick a track type
    setShowNewTrack(true);
  };

  onMount(async () => {
    seq = new StepSequencer();
    seq.onStep = (i) => setCurrentStep(i);

    try {
      const id = await userId();
      if (!id) { setError("Not signed in"); return; }
      const res = await fetch(`/api/projects/${params.id}`, { headers: { "x-user-id": id } });
      if (!res.ok) { setError(`Couldn't load (${res.status})`); return; }
      const doc = await res.json();

      const hasTracks = ((doc.uiTracks as UITrack[] | undefined)?.length ?? 0) > 0;
      const hasBeat = (doc.beat?.pattern?.rows as any[] | undefined)?.some(
        (r: any) => r.velocities?.some((v: number) => v > 0)
      );

      if (hasTracks || hasBeat) {
        // Has saved session data — ask the user
        pendingDoc = doc;
        setShowRestoreDialog(true);
      } else {
        // Nothing saved yet — just apply (sets name/bpm) and open the picker
        await applyDoc(doc);
        setShowNewTrack(true);
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get("new") === "1") {
          searchParams.delete("new");
          window.history.replaceState({}, "", window.location.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ""));
        }
      }
    } catch (err) {
      setError(String(err));
    }
  });

  // ───── Synth & keyboard ─────
  const ensureSynth = (preset: SynthPreset = "piano") => {
    if (!synth) {
      synth = new PolySynth(preset);
      // Apply the current master volume to the freshly created synth instance.
      const db = masterVol() <= 0.001 ? -60 : 20 * Math.log10(masterVol());
      synth.setMasterGainDb(db);
    } else {
      synth.setPreset(preset);
    }
  };

  const KEY_MAP: Record<string, number> = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
    k: 12, o: 13, l: 14, p: 15, ";": 16,
  };

  const onKeyDown = async (e: KeyboardEvent) => {
    const sel = tracks().find(t => t.id === selectedTrack());
    if (!sel || (sel.type !== "instrument" && sel.type !== "bass" && sel.type !== "guitar")) return;
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "z") { setOctave(Math.max(1, octave() - 1)); return; }
    if (k === "x") { setOctave(Math.min(7, octave() + 1)); return; }
    
    const keyVal = KEY_MAP[k];
    if (keyVal === undefined) return;
    
    if (heldKeys.has(k)) return;
    heldKeys.add(k);
    e.preventDefault();
    await unlockAudioContext();
    // Derive preset from the selected track type so bass always sounds like bass
    // even if the synthPreset signal hasn't settled yet.
    const activePreset: SynthPreset = sel.type === "bass" ? "bass"
      : sel.type === "guitar" ? "guitar"
      : synthPreset();
    ensureSynth(activePreset);
    const midi = 12 * (octave() + 1) + keyVal;
    synth!.noteOn(midi, 0.85);
    const next = new Set(activeNotes());
    next.add(midi);
    setActiveNotes(next);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const keyVal = KEY_MAP[k];
    if (keyVal === undefined || !heldKeys.has(k)) return;
    heldKeys.delete(k);
    const midi = 12 * (octave() + 1) + keyVal;
    synth?.noteOff(midi);
    const next = new Set(activeNotes());
    next.delete(midi);
    setActiveNotes(next);
  };

  const pressKey = async (midi: number) => {
    await unlockAudioContext();
    // Derive preset from the selected track type so clicking bass fretboard cells
    // always uses the bass sampler, not whatever synthPreset() currently is.
    const sel = tracks().find(t => t.id === selectedTrack());
    const activePreset: SynthPreset = sel?.type === "bass" ? "bass"
      : sel?.type === "guitar" ? "guitar"
      : synthPreset();
    ensureSynth(activePreset);
    synth!.noteOn(midi, 0.85);
    const next = new Set(activeNotes());
    next.add(midi);
    setActiveNotes(next);
  };
  const releaseKey = (midi: number) => {
    synth?.noteOff(midi);
    const next = new Set(activeNotes());
    next.delete(midi);
    setActiveNotes(next);
  };

  const updatePreset = (p: SynthPreset) => {
    setSynthPreset(p);
    if (synth) synth.setPreset(p);
    // Restore ADSR defaults when switching to a synth preset
    if (p === "lead" || p === "pad") {
      const d = PRESET_ADSR[p];
      setSynthAttack(d.attack); setSynthDecay(d.decay);
      setSynthSustain(d.sustain); setSynthRelease(d.release);
      setSynthFilterFreq(d.filterFreq);
    }
    // Match octave to preset so bass sounds in the right range
    if (p === "bass") setOctave(2);
    else if (p !== synthPreset()) setOctave(4);
  };

  const updateEnvelope = (a: number, d: number, s: number, r: number) => {
    setSynthAttack(a); setSynthDecay(d); setSynthSustain(s); setSynthRelease(r);
    synth?.setEnvelope(a, d, s, r);
  };
  const updateFilterFreq = (freq: number) => {
    setSynthFilterFreq(freq);
    synth?.setFilterFreq(freq);
  };

  onMount(() => {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
  });

  onCleanup(() => {
    seq?.stop();
    synth?.allNotesOff();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (elapsedTimer) clearInterval(elapsedTimer);
  });

  const addTrack = (type: TrackType, openModal = true) => {
    const def = TRACK_DEFS.find(d => d.type === type);
    if (!def) return;
    if (!def.ready) {
      setError(`${def.label} coming soon — try Drum Machine`);
      setTimeout(() => setError(""), 2200);
      return;
    }
    // For drum we only allow one for now
    if (type === "drum" && tracks().some(t => t.type === "drum")) {
      setSelectedTrack(tracks().find(t => t.type === "drum")!.id);
      setDrumPanelOpen(true);
      if (openModal) setShowNewTrack(false);
      return;
    }
    if (type === "instrument" || type === "bass" || type === "guitar") {
      const initPreset = type === "bass" ? "bass" : type === "guitar" ? "guitar" : synthPreset();
      ensureSynth(initPreset);
      if (type === "bass") setSynthPreset("bass");
      else if (type === "guitar") setSynthPreset("guitar");
    }
    const t: UITrack = {
      id: crypto.randomUUID(),
      name: def.label,
      type,
      muted: false,
      solo: false,
      volume: 0.8,
      pan: 0,
      // Drum keeps its iconic amber; everything else gets a fresh random color
      color: type === "drum" ? def.color : randomTrackColor(),
    };
    setTracks([...tracks(), t]);
    setSelectedTrack(t.id);
    if (type === "drum") { setDrumPanelOpen(true); setActivePanel("drum"); }
    else if (type === "instrument" || type === "bass" || type === "guitar") setActivePanel("keys");
    if (openModal) setShowNewTrack(false);
    // Auto-save so restore dialog triggers on next load
    void save();
  };

  const deleteTrack = (id: string) => {
    setTracks(tracks().filter(t => t.id !== id));
    if (selectedTrack() === id) setSelectedTrack(null);
    // Auto-save so the deletion persists on reload
    save();
  };

  const patchTrack = (id: string, patch: Partial<UITrack>) => {
    setTracks(tracks().map(t => t.id === id ? { ...t, ...patch } : t));
  };

  // ── Media clips (drag-drop audio / midi / video onto a lane) ─────────────
  const BAR_PX = 80; // 1 bar = 5rem = 80px (must match SCSS .bl__bar / .bl__lanes)
  const [dropTarget, setDropTarget] = createSignal<{ trackId: string; bar: number } | null>(null);

  const classifyFile = (file: File): ClipKind | null => {
    const name = file.name.toLowerCase();
    if (file.type.startsWith("audio/") || /\.(mp3|wav|ogg|flac|m4a|aac)$/.test(name)) return "audio";
    if (file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/.test(name)) return "video";
    if (file.type === "audio/midi" || /\.(mid|midi)$/.test(name)) return "midi";
    return null;
  };

  const estimateBars = async (file: File, kind: ClipKind): Promise<number> => {
    if (kind === "midi") return 4;
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const el = kind === "video" ? document.createElement("video") : document.createElement("audio");
        el.preload = "metadata";
        el.src = url;
        const done = (bars: number) => { URL.revokeObjectURL(url); resolve(bars); };
        el.onloadedmetadata = () => {
          const secs = el.duration;
          if (!isFinite(secs) || secs <= 0) return done(4);
          const beatsPerSec = bpm() / 60;
          const bars = Math.max(1, Math.round((secs * beatsPerSec) / 4));
          done(bars);
        };
        el.onerror = () => done(4);
      } catch { resolve(4); }
    });
  };

  const addClip = async (trackId: string, file: File, barStart: number) => {
    const kind = classifyFile(file);
    if (!kind) {
      setError("Unsupported file — drop audio, MIDI, or video");
      setTimeout(() => setError(""), 2200);
      return;
    }
    const bars = await estimateBars(file, kind);
    const clipId = crypto.randomUUID();
    let url: string | undefined;
    if (kind !== "midi") {
      url = URL.createObjectURL(file);
      await storeClip(clipId, file).catch(() => {}); // persist to IDB
    }
    const clip: MediaClip = {
      id: clipId,
      kind,
      name: file.name.replace(/\.[^.]+$/, ""),
      barStart: Math.max(0, barStart),
      bars,
      url,
    };
    setTracks(tracks().map(t =>
      t.id === trackId ? { ...t, clips: [...(t.clips ?? []), clip] } : t
    ));
  };

  const deleteClip = (trackId: string, clipId: string) => {
    setTracks(tracks().map(t => {
      if (t.id !== trackId) return t;
      const target = (t.clips ?? []).find(c => c.id === clipId);
      if (target?.url) URL.revokeObjectURL(target.url);
      removeClip(clipId).catch(() => {}); // remove from IDB
      return { ...t, clips: (t.clips ?? []).filter(c => c.id !== clipId) };
    }));
  };

  // Import one or more files: each spawns a new instrument/audio track at the bottom
  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    for (const f of files) {
      const kind = classifyFile(f);
      if (!kind) continue;
      const type = kind === "midi" ? "instrument" : "voice";
      // Avoid repeating the previous track's color when possible
      const lastColor = tracks().slice(-1)[0]?.color;
      const newTrack: UITrack = {
        id: crypto.randomUUID(),
        name: f.name.replace(/\.[^.]+$/, ""),
        type,
        muted: false, solo: false,
        volume: 0.8, pan: 0,
        color: randomTrackColor(lastColor), clips: [],
      };
      // Append at the end so new tracks always appear UNDER existing tracks
      setTracks(prev => [...prev, newTrack]);
      setSelectedTrack(newTrack.id);
      await addClip(newTrack.id, f, 0);
    }
    // Auto-save so tracks + clips persist on reload
    save();
  };

  const onLaneDragOver = (e: DragEvent, trackId: string) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scrollLeft = timelineEl?.scrollLeft ?? 0;
    const x = e.clientX - rect.left + scrollLeft;
    const bar = Math.max(0, Math.floor(x / BAR_PX));
    setDropTarget({ trackId, bar });
  };
  const onLaneDragLeave = (e: DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null))
      setDropTarget(null);
  };
  const onLaneDrop = async (e: DragEvent, trackId: string) => {
    e.preventDefault();
    setDropTarget(null);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scrollLeft = timelineEl?.scrollLeft ?? 0;
    const x = e.clientX - rect.left + scrollLeft;
    const startBar = Math.max(0, Math.floor(x / BAR_PX));
    let cursor = startBar;
    for (const f of files) {
      await addClip(trackId, f, cursor);
      const last = tracks().find(t => t.id === trackId)?.clips?.slice(-1)[0];
      cursor += last?.bars ?? 4;
    }
  };

  // Global drop zone on the lanes container — auto-creates a track when no track is targeted
  const [globalDragOver, setGlobalDragOver] = createSignal(false);
  const onLanesDragOver = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    // only handle if not already over a specific lane
    if (dropTarget()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setGlobalDragOver(true);
  };
  const onLanesDragLeave = (e: DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null))
      setGlobalDragOver(false);
  };
  const onLanesDrop = async (e: DragEvent) => {
    if (dropTarget()) return; // let lane handler take it
    e.preventDefault();
    setGlobalDragOver(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    await importFiles(files);
  };

  const togglePlay = async () => {
    if (!seq) return;
    await unlockAudioContext();
    if (playing()) {
      seq.stop();
      setPlaying(false);
      if (elapsedTimer) clearInterval(elapsedTimer);
      elapsedTimer = null;
      stopAudioPlayback();
    } else {
      await seq.start();
      setPlaying(true);
      startTime = performance.now();
      elapsedTimer = setInterval(() => setElapsed((performance.now() - startTime) / 1000), 50);
      await startAudioPlayback();
    }
  };

  const stopAll = () => {
    if (!seq) return;
    seq.stop();
    setPlaying(false);
    setElapsed(0);
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = null;
    stopAudioPlayback();
    setPlayheadPx(0);
  };

  const updateBpm = (v: number) => {
    const clamped = Math.max(40, Math.min(240, v || 100));
    setBpm(clamped);
    if (seq) {
      seq.setBpm(clamped);
      setPattern({ ...seq.getPattern() });
    }
  };

  const toggleStep = (rowIdx: number, stepIdx: number) => {
    if (!seq) return;
    seq.toggleStep(rowIdx, stepIdx);
    const p = seq.getPattern();
    // Preview the hit when turning ON (velocity will now be > 0)
    const row = p.rows[rowIdx];
    if (row && (row.velocities[stepIdx] ?? 0) > 0) {
      void seq.previewDrum(rowIdx);
    }
    setPattern({ ...p, rows: p.rows.map(r => ({ ...r, velocities: [...r.velocities] })) });
  };

  const clearPattern = () => {
    if (!seq) return;
    seq.getPattern().rows.forEach((_, i) => seq!.clearRow(i));
    const p = seq.getPattern();
    setPattern({ ...p, rows: p.rows.map(r => ({ ...r, velocities: [...r.velocities] })) });
  };

  const cycleStepVelocity = (rowIdx: number, stepIdx: number) => {
    if (!seq) return;
    const row = seq.getPattern().rows[rowIdx];
    if (!row) return;
    const cur = row.velocities[stepIdx] ?? 0;
    const next = cur <= 0 ? 1.0 : cur >= 0.9 ? 0.6 : cur >= 0.5 ? 0.3 : 0;
    seq.setStepVelocity(rowIdx, stepIdx, next);
    const p = seq.getPattern();
    setPattern({ ...p, rows: p.rows.map(r => ({ ...r, velocities: [...r.velocities] })) });
  };

  const toggleRowMute = (rowIdx: number) => {
    if (!seq) return;
    const row = seq.getPattern().rows[rowIdx];
    if (!row) return;
    seq.setRowMuted(rowIdx, !row.muted);
    const p = seq.getPattern();
    setPattern({ ...p, rows: p.rows.map(r => ({ ...r })) });
  };

  const updateRowGain = (rowIdx: number, db: number) => {
    if (!seq) return;
    seq.setRowGainDb(rowIdx, db);
    const p = seq.getPattern();
    setPattern({ ...p, rows: p.rows.map(r => ({ ...r })) });
  };

  const updateSwing = (amount: number) => {
    setDrumSwing(amount);
    seq?.setSwing(amount);
  };

  const updateDrumSteps = (steps: number) => {
    if (!seq) return;
    seq.setSteps(steps);
    setDrumSteps(steps);
    const p = seq.getPattern();
    setPattern({ ...p, rows: p.rows.map(r => ({ ...r, velocities: [...r.velocities] })) });
  };

  const setMasterVolume = (v: number) => {
    setMasterVol(v);
    // map 0..1 → -60..0 dB
    const db = v <= 0.001 ? -60 : 20 * Math.log10(v);
    // Drum sequencer
    if (seq) seq.setMasterGainDb(db);
    // Instrument / synth
    if (synth) synth.setMasterGainDb(db);
    // Audio clips currently playing
    if (masterGainNode) masterGainNode.gain.setTargetAtTime(v, getAudioContext().currentTime, 0.01);
  };

  const startEditingTitle = () => {
    setTitleEditing(true);
    queueMicrotask(() => {
      titleInputEl?.focus();
      titleInputEl?.select();
    });
  };

  const commitTitle = async () => {
    if (!titleEditing()) return;
    const next = (titleInputEl?.value ?? "").trim();
    setTitleEditing(false);
    if (!next || next === name()) return;
    setName(next);
    try { await updateProjectApi(params.id, { name: next }); } catch { /* ignore */ }
  };

  const cancelTitle = () => {
    if (titleInputEl) titleInputEl.value = name();
    setTitleEditing(false);
  };

  const save = async () => {
    if (!seq) return;
    setSaveState("saving");
    try {
      const id = await userId();
      if (!id) throw new Error("not signed in");
      const res = await fetch(`/api/projects/${params.id}`, { headers: { "x-user-id": id } });
      if (!res.ok) throw new Error(`load failed: ${res.status}`);
      const doc = await res.json();
      // Strip blob URLs before sending — they are session-only and useless
      // after reload. Blobs are persisted in IndexedDB via clipStore.ts.
      const uiTracksForSave = tracks().map(t => ({
        ...t,
        clips: (t.clips ?? []).map(c => ({ ...c, url: undefined })),
      }));
      const updated = {
        ...doc,
        beat: { pattern: seq.getPattern() },
        transport: { ...(doc.transport ?? {}), bpm: bpm() },
        uiTracks: uiTracksForSave,
      };
      const put = await fetch(`/api/projects/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": id },
        body: JSON.stringify(updated),
      });
      if (!put.ok) throw new Error(`save failed: ${put.status}`);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (err) {
      console.error(err);
      setError(String(err));
      setSaveState("idle");
    }
  };

  // Generate ruler bars (450 bars total)
  const bars = Array.from({ length: 450 }, (_, i) => i + 1);

  // ── Playhead ────────────────────────────────────────────────────────────────
  // Position in pixels from the start of the timeline (1 bar = 80px).
  const [playheadPx, setPlayheadPx] = createSignal(0);

  // (Playhead is advanced in real-time by startAudioPlayback's RAF loop)

  // Horizontal scroll: wheel + middle-button drag (BandLab-style pan)
  let timelineEl: HTMLDivElement | undefined;
  const onTimelineWheel = (e: WheelEvent) => {
    if (!timelineEl) return;
    if (e.shiftKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      timelineEl.scrollLeft += e.deltaY;
    }
  };
  let dragState: { x: number; scroll: number } | null = null;
  const onTimelineMouseDown = (e: MouseEvent) => {
    if (e.button !== 1) return;
    if (!timelineEl) return;
    e.preventDefault();
    dragState = { x: e.clientX, scroll: timelineEl.scrollLeft };
    document.body.style.cursor = "grabbing";
  };

  // Ruler left-click / drag → seek playhead
  let playheadDragState: { startX: number; startPx: number } | null = null;
  const onRulerMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!timelineEl) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = timelineEl.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left + timelineEl.scrollLeft);
    setPlayheadPx(x);
    playheadDragState = { startX: e.clientX, startPx: x };
    document.body.style.cursor = "col-resize";
  };

  const onWinMouseMove = (e: MouseEvent) => {
    if (dragState && timelineEl) {
      timelineEl.scrollLeft = dragState.scroll - (e.clientX - dragState.x);
    }
    if (playheadDragState) {
      const dx = e.clientX - playheadDragState.startX;
      setPlayheadPx(Math.max(0, playheadDragState.startPx + dx));
    }
  };
  const onWinMouseUp = () => {
    if (dragState) {
      dragState = null;
      document.body.style.cursor = "";
    }
    if (playheadDragState) {
      playheadDragState = null;
      document.body.style.cursor = "";
    }
  };
  onMount(() => {
    window.addEventListener("mousemove", onWinMouseMove);
    window.addEventListener("mouseup", onWinMouseUp);
  });
  onCleanup(() => {
    window.removeEventListener("mousemove", onWinMouseMove);
    window.removeEventListener("mouseup", onWinMouseUp);
    stopAudioPlayback();
  });

  // Compute clip block style for drum row
  const drumClipBars = createMemo(() => {
    const totalBars = 4;
    return Array.from({ length: totalBars }, (_, i) => i);
  });

  // ADSR envelope path for the Lead/Pad visualizer (SVG 200×52 coordinate space)
  const adsrPath = createMemo(() => {
    const a = Math.max(0.001, synthAttack());
    const d = Math.max(0.001, synthDecay());
    const s = synthSustain();
    const r = Math.max(0.001, synthRelease());
    const hold = 0.5; // fixed visual sustain hold width
    const total = a + d + hold + r;
    const W = 200, H = 52;
    const aw = (a / total) * W;
    const dw = (d / total) * W;
    const sw = (hold / total) * W;
    const sy = 2 + (1 - s) * (H - 4);
    const stroke = `M0,${H} L${aw.toFixed(1)},2 L${(aw+dw).toFixed(1)},${sy.toFixed(1)} L${(aw+dw+sw).toFixed(1)},${sy.toFixed(1)} L${W},${H}`;
    return { stroke, fill: `${stroke} Z` };
  });

  return (
    <div class="bl">
      {/* TOP BAR */}
      <header class="bl__top">
        {/* ROW 1 — title strip */}
        <div class="bl__strip">
          <div class="bl__strip-l">
            <button class="bl__icon-btn" onClick={() => setNavOpen(!navOpen())} title="Menu">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6h12M2 10h12"/></svg>
            </button>
            <button class="bl__brand" onClick={() => navigate("/dashboard")}>
              <span class="bl__brand-melo">Melo</span>
              <span class="bl__brand-studio">Studio</span>
            </button>
          </div>

          <div class="bl__strip-c">
            <span class="bl__title-eyebrow">Project</span>
            <Show
              when={titleEditing()}
              fallback={
                <button
                  class="bl__title bl__title--btn"
                  onClick={startEditingTitle}
                  title="Click to rename"
                >
                  <span class="bl__title-text">{name()}</span>
                  <svg class="bl__title-pencil" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" />
                    <path d="M10 4l2 2" />
                  </svg>
                </button>
              }
            >
              <input
                ref={(el) => (titleInputEl = el)}
                class="bl__title bl__title--edit"
                value={name()}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
                  else if (e.key === "Escape") { e.preventDefault(); cancelTitle(); }
                }}
              />
            </Show>
          </div>

          <div class="bl__strip-r">
            <div class="bl__save-status">
              <span class="bl__save-label">Last Saved</span>
              <span class="bl__save-sub">{saveState() === "saved" ? "Just now" : "Never"}</span>
            </div>
            <button class="bl__btn-ghost" onClick={save} disabled={saveState() === "saving"}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7l3 3v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M5 3v3h5"/><circle cx="8" cy="10" r="1.5"/></svg>
              <span>{saveState() === "saving" ? "Saving" : saveState() === "saved" ? "Saved" : "Save"}</span>
            </button>
            <button class="bl__btn-pink-out" disabled>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V3"/><path d="M5 6l3-3 3 3"/><path d="M3 13h10"/></svg>
              <span>Publish</span>
            </button>
            <button class="bl__btn-ghost bl__btn-invite" disabled>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="2.5"/><path d="M3 13a5 5 0 0 1 10 0"/></svg>
              <span>Invite</span>
            </button>
            <button class="bl__icon-btn bl__bell" title="Notifications">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2a4 4 0 0 0-4 4v3l-1 2h10l-1-2V6a4 4 0 0 0-4-4z"/><path d="M6.5 13a1.5 1.5 0 0 0 3 0"/></svg>
              <span class="bl__bell-dot" />
            </button>
          </div>
        </div>

        {/* ROW 2 — console */}
        <div class="bl__console">
          <div class="bl__console-l">
            <div class="bl__tools">
              <button class="bl__icon-btn" title="Undo">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7a3 3 0 0 1 0 6H6"/><path d="M5.5 4.5L3 7l2.5 2.5"/></svg>
              </button>
              <button class="bl__icon-btn" title="Redo">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7H6a3 3 0 0 0 0 6h4"/><path d="M10.5 4.5L13 7l-2.5 2.5"/></svg>
              </button>
              <button class="bl__icon-btn" title="Metronome">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l-2 10h10L11 3z"/><path d="M8 6v5"/></svg>
              </button>
            </div>

            <div class="bl__session" role="group" aria-label="Session settings">
              <div class="bl__session-cell bl__session-cell--num">
                <span class="bl__session-key">
                  <span class="bl__session-num">01</span>
                  <span class="bl__session-key-text">Tempo</span>
                </span>
                <span class="bl__session-value">
                  <input
                    class="bl__session-input"
                    type="number"
                    min="40" max="240"
                    value={bpm()}
                    onInput={(e) => updateBpm(parseInt(e.currentTarget.value, 10))}
                  />
                  <span class="bl__session-unit">bpm</span>
                </span>
              </div>
              <div class="bl__session-cell">
                <span class="bl__session-key">
                  <span class="bl__session-num">02</span>
                  <span class="bl__session-key-text">Meter</span>
                </span>
                <span class="bl__session-value">
                  4<span class="bl__session-slash">⁄</span>4
                </span>
              </div>
              <button class="bl__session-cell bl__session-cell--btn" type="button">
                <span class="bl__session-key">
                  <span class="bl__session-num">03</span>
                  <span class="bl__session-key-text">Key</span>
                </span>
                <span class="bl__session-value bl__session-value--script">
                  Auto
                  <svg class="bl__session-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5l3 3 3-3"/></svg>
                </span>
              </button>
            </div>
          </div>

          <div class="bl__console-c">
            <button class="bl__t-btn" onClick={() => setElapsed(0)} title="Skip to start">
              <svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3.5" width="1.5" height="9" rx="0.5"/><path d="M13 3.5v9L5.5 8z"/></svg>
            </button>
            <button class={`bl__t-play ${playing() ? "is-on" : ""}`} onClick={togglePlay} title={playing() ? "Pause" : "Play"}>
              {playing()
                ? <svg viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="0.5"/><rect x="9" y="3" width="3" height="10" rx="0.5"/></svg>
                : <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5v9l8-4.5z"/></svg>}
            </button>
            <button class="bl__t-btn bl__t-rec" title="Record" onClick={stopAll}>
              <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="4"/></svg>
            </button>
            <button class="bl__t-btn" title="Loop">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6V5a2 2 0 0 1 2-2h6"/><path d="M9 1l2 2-2 2"/><path d="M13 10v1a2 2 0 0 1-2 2H5"/><path d="M7 15l-2-2 2-2"/></svg>
            </button>
            <div class="bl__timecode">{fmtTime(elapsed())}</div>
          </div>

          <div class="bl__console-r">
            <button class="bl__mastering" type="button" title="Mastering preset">
              <span class="bl__mastering-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="8" cy="8" r="5.2" />
                  <path d="M8 3v2M8 11v2M3 8h2M11 8h2M4.6 4.6l1.4 1.4M10 10l1.4 1.4M11.4 4.6L10 6M6 10l-1.4 1.4" />
                </svg>
              </span>
              <span class="bl__mastering-name">Studio</span>
              <svg class="bl__mastering-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5l3 3 3-3"/></svg>
            </button>

            <span class="bl__field-sep" />

            <div
              class="bl__master-vol"
              title="Master volume"
              style={{ "--vol": `${Math.round(masterVol() * 100)}%` }}
            >
              <span class="bl__master-vol-head">
                <span class="bl__master-vol-label">Master</span>
                <span class="bl__db">{masterVol() <= 0.001 ? "-∞" : (20 * Math.log10(masterVol())).toFixed(1)}<span class="bl__db-unit"> dB</span></span>
              </span>
              <div class="bl__master-vol-row">
                <button
                  class="bl__master-vol-icon"
                  type="button"
                  onClick={() => setMasterVolume(masterVol() > 0.001 ? 0 : 0.8)}
                  title={masterVol() <= 0.001 ? "Unmute" : "Mute"}
                >
                  <Show
                    when={masterVol() > 0.001}
                    fallback={
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M7 4L4 6.5H2v3h2L7 12V4z" fill="currentColor"/>
                        <path d="M10.5 6l4 4M14.5 6l-4 4"/>
                      </svg>
                    }
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M7 4L4 6.5H2v3h2L7 12V4z" fill="currentColor"/>
                      <Show when={masterVol() > 0.05}><path d="M10.5 6a3 3 0 0 1 0 4"/></Show>
                      <Show when={masterVol() > 0.5}><path d="M12.5 4a6 6 0 0 1 0 8"/></Show>
                    </svg>
                  </Show>
                </button>
                <input
                  class="bl__master-vol-range"
                  type="range"
                  min="0" max="1" step="0.01"
                  value={masterVol()}
                  onInput={(e) => setMasterVolume(parseFloat(e.currentTarget.value))}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <Show when={error()}>
        <div class="bl__toast">{error()}</div>
      </Show>

      {/* MAIN: tracks sidebar + timeline */}
      <div class="bl__main">
        <aside class="bl__tracks-side">
          <div class="bl__add-row">
            <div class="bl__add-wrap">
              <button
                class="bl__add-track"
                onClick={() => setShowAddMenu(v => !v)}
              >
                <span class="bl__add-plus">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>
                </span>
                <span>Add Track</span>
              </button>

              <Show when={showAddMenu()}>
                <div class="bl__add-menu-backdrop" onClick={() => setShowAddMenu(false)} />
                <div class="bl__add-menu" onClick={(e) => e.stopPropagation()}>
                  <div class="bl__add-menu-head">
                    <span class="bl__add-menu-eyebrow">— New source</span>
                  </div>
                  <For each={TRACK_DEFS}>
                    {(def) => (
                      <button
                        class={`bl__add-menu-item ${def.ready ? "" : "is-locked"}`}
                        disabled={!def.ready}
                        onClick={() => {
                          if (!def.ready) return;
                          addTrack(def.type);
                          setShowAddMenu(false);
                        }}
                      >
                        <span class="bl__add-menu-icon" aria-hidden="true"><TrackIcon name={def.icon} /></span>
                        <span class="bl__add-menu-text">
                          <span class="bl__add-menu-title">
                            {def.label}
                            <Show when={!def.ready}><span class="bl__nt-soon">Soon</span></Show>
                          </span>
                          <span class="bl__add-menu-tag">{def.tag}</span>
                        </span>
                      </button>
                    )}
                  </For>
                  <button
                    class="bl__add-menu-foot"
                    onClick={() => { setShowAddMenu(false); setShowNewTrack(true); }}
                  >
                    Browse all sources
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                  </button>
                </div>
              </Show>
            </div>
            <button class="bl__add-tool" title="Track tools" disabled>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9-3 1 1-3z"/><path d="M9 4l3 3"/></svg>
            </button>
            <button class="bl__add-tool" title="Track view" disabled>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 8h2M6 4v8M10 6v4M14 8h-1"/><circle cx="6" cy="4" r="1" fill="currentColor"/><circle cx="10" cy="6" r="1" fill="currentColor"/></svg>
            </button>
          </div>
          <button class="bl__automix">
            <span class="bl__automix-glow" />
            <span class="bl__automix-spark">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z"/></svg>
            </span>
            <span class="bl__automix-text">
              <span class="bl__automix-label">AutoMix</span>
              <span class="bl__automix-sub">AI · Mix &amp; master</span>
            </span>
            <svg class="bl__automix-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
          </button>

          <div class="bl__track-list">
            <For each={tracks()}>
              {(t) => (
                <div
                  class={`bl__track ${selectedTrack() === t.id ? "is-sel" : ""}`}
                  style={{ "--tc": t.color }}
                  onClick={() => setSelectedTrack(t.id)}
                >
                  <div class="bl__track-col">
                    <TrackIcon name={TRACK_DEFS.find(d => d.type === t.type)?.icon ?? ""} />
                  </div>
                  <div class="bl__track-body">
                    <div class="bl__track-head">
                      <input
                        class="bl__track-name"
                        value={t.name}
                        onInput={(e) => patchTrack(t.id, { name: e.currentTarget.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        class="bl__track-x"
                        onClick={(e) => { e.stopPropagation(); deleteTrack(t.id); }}
                        title="Delete track"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                      </button>
                    </div>
                    <div class="bl__track-controls" onClick={(e) => e.stopPropagation()}>
                      <button
                        class={`bl__chip-btn ${t.muted ? "is-on-mute" : ""}`}
                        title="Mute"
                        onClick={() => patchTrack(t.id, { muted: !t.muted })}
                      >M</button>
                      <button
                        class={`bl__chip-btn ${t.solo ? "is-on-solo" : ""}`}
                        title="Solo"
                        onClick={() => patchTrack(t.id, { solo: !t.solo })}
                      >S</button>
                      <input
                        class="bl__slider"
                        type="range" min="0" max="1" step="0.01"
                        value={t.volume}
                        onChange={(e) => patchTrack(t.id, { volume: parseFloat(e.currentTarget.value) })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </For>

            <Show when={tracks().length === 0}>
              <div class="bl__sidebar-hint" />
            </Show>
          </div>
        </aside>

        <section
          class="bl__timeline"
          ref={timelineEl}
          onWheel={onTimelineWheel}
          onMouseDown={onTimelineMouseDown}
        >
          {/* Ruler — left-click or drag to seek the playhead */}
          <div class="bl__ruler" onMouseDown={onRulerMouseDown}>
            <For each={bars}>
              {(b) => (
                <div class="bl__bar">
                  <span class="bl__bar-num">{b}</span>
                </div>
              )}
            </For>
          </div>

          {/* Track lanes */}
          <div
            class={`bl__lanes ${globalDragOver() ? "is-global-drop" : ""}`}
            onDragOver={onLanesDragOver}
            onDragLeave={onLanesDragLeave}
            onDrop={onLanesDrop}
          >
            <Show when={tracks().length === 0}>
              <div class="bl__stage-empty">
                <div class={`bl__stage-empty-card ${globalDragOver() ? "is-drop" : ""}`}>
                  <Show when={!globalDragOver()} fallback={
                    <>
                      <span class="bl__stage-empty-eyebrow">Release to import</span>
                      <h2 class="bl__stage-empty-title">Drop it in</h2>
                      <p class="bl__stage-empty-sub">Audio, MIDI, and video files are supported</p>
                    </>
                  }>
                    <span class="bl__stage-empty-eyebrow">Empty session</span>
                    <h2 class="bl__stage-empty-title">Your canvas awaits</h2>
                    <p class="bl__stage-empty-sub">Add a track from the left, or drag any audio / MIDI / video file here.</p>
                    <div class="bl__stage-empty-actions">
                      <button class="bl__btn-pink" onClick={() => setShowNewTrack(true)}>+ Add a track</button>
                      <button class="bl__btn-ghost" onClick={() => addTrack("drum")}>Drum machine</button>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            <For each={tracks()}>
              {(t) => (
                <div
                  class={`bl__lane ${selectedTrack() === t.id ? "is-sel" : ""} ${dropTarget()?.trackId === t.id ? "is-drop" : ""}`}
                  style={{ "--tc": t.color }}
                  onDragOver={(e) => onLaneDragOver(e, t.id)}
                  onDragLeave={onLaneDragLeave}
                  onDrop={(e) => onLaneDrop(e, t.id)}
                >
                    <Show when={t.type === "drum"}>
                      <For each={drumClipBars()}>
                        {(barIdx) => (
                          <div
                            class="bl__clip"
                            style={{ left: `${barIdx * 80}px`, width: "78px", "--tc": t.color }}
                          >
                            <div class="bl__clip-header">
                              <span class="bl__clip-dot-led" />
                              <span class="bl__clip-name">DRUMS</span>
                            </div>
                            <div class="bl__clip-matrix">
                              <For each={pattern().rows.slice(0, 8)}>
                                {(row) => (
                                  <div class="bl__clip-mrow">
                                    <For each={row.velocities.slice(0, 16)}>
                                      {(v, i) => (
                                        <span
                                          class="bl__clip-cell"
                                          classList={{
                                            "is-hit": v > 0,
                                            "is-beat": i() % 4 === 0,
                                            "is-soft": v > 0 && v < 0.55,
                                          }}
                                        />
                                      )}
                                    </For>
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        )}
                      </For>
                    </Show>
                    {/* Instrument ghost block — shows in bar 1 when no clips yet */}
                    <Show when={(t.type === "instrument" || t.type === "bass" || t.type === "guitar" || t.type === "voice") && (t.clips ?? []).length === 0}>
                      <div class="bl__inst-ghost" style={{ "--tc": t.color }}>
                        <span class="bl__inst-ghost-dot" />
                        <span class="bl__inst-ghost-name">
                          {t.type === "bass" ? "BASS" : t.type === "guitar" ? "GUITAR" : t.type === "voice" ? "VOICE" : "LEAD"}
                        </span>
                        <span class="bl__inst-ghost-hint">play keys to record</span>
                      </div>
                    </Show>
                    <For each={t.clips ?? []}>
                      {(c) => (
                        <div
                          class={`bl__mclip is-${c.kind}`}
                          style={{
                            left: `${c.barStart * 80}px`,
                            width: `${c.bars * 80 - 2}px`,
                            "--tc": t.color,
                          }}
                          title={`${c.name} · ${c.bars} bar${c.bars > 1 ? "s" : ""}`}
                        >
                          <div class="bl__mclip-head">
                            <span class="bl__mclip-icon" aria-hidden="true">
                              <MediaClipIcon kind={c.kind} />
                            </span>
                            <span class="bl__mclip-name">{c.name}</span>
                            <button
                              class="bl__mclip-x"
                              onClick={(e) => { e.stopPropagation(); deleteClip(t.id, c.id); }}
                              title="Remove clip"
                            >×</button>
                          </div>
                          <div class="bl__mclip-body">
                            <Show when={c.kind !== "midi" && c.url}>
                              <AudioWaveformDisplay
                                url={c.url}
                                color={t.color}
                              />
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                    <Show when={dropTarget()?.trackId === t.id}>
                      <div
                        class="bl__drop-marker"
                        style={{ left: `${(dropTarget()?.bar ?? 0) * 80}px` }}
                      />
                    </Show>
                  </div>
              )}
            </For>

            {/* Drop zone — ghost lane below the last track */}
            <Show when={tracks().length > 0}>
              <div
                class={`bl__import-drop ${globalDragOver() ? "is-over" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => importInputEl?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); importInputEl?.click(); } }}
                onDragOver={(e) => {
                  if (!e.dataTransfer?.types.includes("Files")) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setGlobalDragOver(true);
                }}
                onDragLeave={(e) => {
                  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null))
                    setGlobalDragOver(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setGlobalDragOver(false);
                  const files = Array.from(e.dataTransfer?.files ?? []);
                  await importFiles(files);
                }}
              >
                <input
                  ref={(el) => (importInputEl = el)}
                  type="file"
                  accept="audio/*,video/*,.mid,.midi"
                  multiple
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const files = Array.from(e.currentTarget.files ?? []);
                    e.currentTarget.value = "";
                    await importFiles(files);
                  }}
                />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" class="bl__import-drop-icon" aria-hidden="true">
                  <path d="M9 18V6l12-2v12"/>
                  <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  <line x1="2" y1="2" x2="2" y2="6"/><line x1="0" y1="4" x2="4" y2="4"/>
                </svg>
                <span>Drop a loop or an audio/MIDI/video file</span>
              </div>
            </Show>
          </div>

          {/* Playhead — always visible; drag the diamond handle to seek */}
          <div
            class="bl__playhead"
            style={{ left: `${playheadPx()}px` }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              playheadDragState = { startX: e.clientX, startPx: playheadPx() };
              document.body.style.cursor = "col-resize";
            }}
          />
        </section>
      </div>

      {/* DRUM MACHINE PANEL */}
      <Show when={activePanel() === "drum" && tracks().some(t => t.type === "drum")}>
        <section class="bl__drum-panel">
          <div class="bl__dp-head">
            <div class="bl__dp-title">
              <span class="bl__dp-icon" style={{ color: "#f5b53e", display: "flex", "align-items": "center", "justify-content": "center" }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4c-4.4 0-8 1.6-8 3.5s3.6 3.5 8 3.5 8-1.6 8-3.5-3.6-3.5-8-3.5z"/><path d="M4 7.5v9c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-9"/><path d="M12 11v6"/></svg>
              </span>
              <span>Drum Machine</span>
              <span class="bl__dp-step">{currentStep() < 0 ? "—" : `Step ${currentStep() + 1}/${drumSteps()}`}</span>
            </div>
            <div class="bl__dp-controls">
              <div class="bl__dp-ctrl-group">
                <span class="bl__dp-ctrl-label">Steps</span>
                <div class="bl__dp-steps-toggle">
                  <button class={`bl__dp-steps-btn ${drumSteps() === 16 ? "is-on" : ""}`} onClick={() => updateDrumSteps(16)}>16</button>
                  <button class={`bl__dp-steps-btn ${drumSteps() === 32 ? "is-on" : ""}`} onClick={() => updateDrumSteps(32)}>32</button>
                </div>
              </div>
              <div class="bl__dp-ctrl-group">
                <span class="bl__dp-ctrl-label">Swing <span class="bl__dp-ctrl-val">{Math.round(drumSwing() * 100)}%</span></span>
                <input
                  class="bl__dp-swing"
                  type="range" min="0" max="0.5" step="0.01"
                  value={drumSwing()}
                  onInput={(e) => updateSwing(parseFloat(e.currentTarget.value))}
                />
              </div>
              <button class="bl__btn-ghost bl__dp-clear" onClick={clearPattern}>Clear</button>
              <button class="bl__icon-btn" onClick={() => setDrumPanelOpen(false)} title="Collapse">−</button>
            </div>
          </div>

          <div class="bl__dp-grid">
            <For each={pattern().rows}>
              {(row, rowIdx) => (
                <div class={`bl__dp-row ${row.muted ? "is-muted" : ""}`}>
                  <div class="bl__dp-rowlabel">
                    <button
                      class={`bl__dp-mute ${row.muted ? "is-muted" : ""}`}
                      onClick={() => toggleRowMute(rowIdx())}
                      title={row.muted ? "Unmute" : "Mute"}
                    >M</button>
                    <span class="bl__dp-rowname">{DRUM_LABEL[row.drum] ?? row.drum}</span>
                    <input
                      class="bl__dp-vol"
                      type="range" min="-20" max="6" step="1"
                      value={row.gainDb}
                      onChange={(e) => updateRowGain(rowIdx(), parseInt(e.currentTarget.value, 10))}
                      title={`Volume: ${row.gainDb}dB`}
                    />
                  </div>
                  <div class="bl__dp-cells" style={{ "grid-template-columns": `repeat(${drumSteps()}, 1fr)` }}>
                    <For each={row.velocities}>
                      {(v, stepIdx) => (
                        <button
                          class={[
                            "bl__dp-cell",
                            v >= 0.9 ? "is-vel-hi" : v >= 0.5 ? "is-vel-med" : v > 0 ? "is-vel-lo" : "",
                            currentStep() === stepIdx() ? "is-cursor" : "",
                            stepIdx() % 4 === 0 ? "is-down" : "",
                          ].filter(Boolean).join(" ")}
                          onClick={() => toggleStep(rowIdx(), stepIdx())}
                          onContextMenu={(e) => { e.preventDefault(); cycleStepVelocity(rowIdx(), stepIdx()); }}
                          aria-label={`${row.drum} step ${stepIdx() + 1}`}
                        />
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>

      {/* KEYBOARD / SYNTH PANEL */}
      <Show when={activePanel() === "keys" && (() => {
        const t = tracks().find(tr => tr.id === selectedTrack());
        return t && (t.type === "instrument" || t.type === "bass" || t.type === "guitar");
      })()}>
        <section class="bl__kb-panel">
          <div class="bl__dp-head">
            <div class="bl__dp-title">
              <span class="bl__dp-icon" style={{ color: "#3ee08b", display: "flex", "align-items": "center", "justify-content": "center" }}>
                {(() => {
                  const t = tracks().find(tr => tr.id === selectedTrack());
                  if (t?.type === "bass" || t?.type === "guitar") return (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M19 14 10 5"/><path d="M12 14 14 12"/><path d="m11 15 2-2"/><path d="m14 8 2-2"/><path d="m15 9 2-2"/><path d="m18 11 2-2"/><path d="M19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>
                  );
                  return (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 6v12"/><path d="M10 6v12"/><path d="M14 6v12"/><path d="M18 6v12"/><path d="M8 6v6"/><path d="M12 6v6"/><path d="M16 6v6"/></svg>
                  );
                })()}
              </span>
              <span>{(() => {
                const t = tracks().find(tr => tr.id === selectedTrack());
                return t?.type === "bass" ? "Bass Synth" : t?.type === "guitar" ? "Guitar" : "Instruments";
              })()}</span>
              <Show when={(() => {
                const t = tracks().find(tr => tr.id === selectedTrack());
                return t && t.type !== "bass" && t.type !== "guitar";
              })()}>
                <div class="bl__preset-row">
                  <For each={[
                    { id: "piano" as const,  label: "Piano" },
                    { id: "guitar" as const, label: "Guitar" },
                    { id: "bass" as const,   label: "Bass" },
                    { id: "lead" as const,   label: "Lead" },
                    { id: "pad" as const,    label: "Pad" },
                  ]}>
                    {(p) => (
                      <button
                        class={`bl__preset ${synthPreset() === p.id ? "is-on" : ""}`}
                        onClick={() => updatePreset(p.id)}
                      >{p.label}</button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
            <div class="bl__dp-actions">
              <button class="bl__icon-btn" onClick={() => setOctave(Math.max(1, octave() - 1))} title="Octave down">−</button>
              <span class="bl__oct">Oct {octave()}</span>
              <button class="bl__icon-btn" onClick={() => setOctave(Math.min(7, octave() + 1))} title="Octave up">+</button>
            </div>
          </div>

          {/* Lead / Pad synth editor — ADSR visualizer + live sliders */}
          <Show when={synthPreset() === "lead" || synthPreset() === "pad"}>
            <div class={`bl__synth-edit ${synthPreset() === "pad" ? "is-pad" : "is-lead"}`}>
              {/* ADSR envelope visualizer */}
              <svg class="bl__adsr-viz" viewBox="0 0 200 52" preserveAspectRatio="none">
                <path d={adsrPath().fill}
                  fill={synthPreset() === "pad" ? "rgba(163,116,247,0.12)" : "rgba(224,82,151,0.12)"}
                />
                <path d={adsrPath().stroke} fill="none"
                  stroke={synthPreset() === "pad" ? "#a374f7" : "#e05297"}
                  stroke-width="1.5" stroke-linejoin="round"
                />
                {/* ADSR section labels */}
                <text x="2" y="50" class="bl__adsr-lbl">A</text>
                <text x="52" y="50" class="bl__adsr-lbl">D</text>
                <text x="105" y="50" class="bl__adsr-lbl">S</text>
                <text x="158" y="50" class="bl__adsr-lbl">R</text>
              </svg>

              {/* Sliders */}
              <div class="bl__synth-sliders">
                <div class="bl__synth-param">
                  <label class="bl__synth-lbl">Attack</label>
                  <input type="range" class="bl__synth-range" min="0.001" max="2" step="0.001"
                    value={synthAttack()}
                    onInput={(e) => updateEnvelope(+e.currentTarget.value, synthDecay(), synthSustain(), synthRelease())}
                  />
                  <span class="bl__synth-val">{synthAttack() < 0.1 ? `${Math.round(synthAttack() * 1000)}ms` : `${synthAttack().toFixed(2)}s`}</span>
                </div>
                <div class="bl__synth-param">
                  <label class="bl__synth-lbl">Decay</label>
                  <input type="range" class="bl__synth-range" min="0.01" max="2" step="0.01"
                    value={synthDecay()}
                    onInput={(e) => updateEnvelope(synthAttack(), +e.currentTarget.value, synthSustain(), synthRelease())}
                  />
                  <span class="bl__synth-val">{synthDecay() < 0.1 ? `${Math.round(synthDecay() * 1000)}ms` : `${synthDecay().toFixed(2)}s`}</span>
                </div>
                <div class="bl__synth-param">
                  <label class="bl__synth-lbl">Sustain</label>
                  <input type="range" class="bl__synth-range" min="0" max="1" step="0.01"
                    value={synthSustain()}
                    onInput={(e) => updateEnvelope(synthAttack(), synthDecay(), +e.currentTarget.value, synthRelease())}
                  />
                  <span class="bl__synth-val">{Math.round(synthSustain() * 100)}%</span>
                </div>
                <div class="bl__synth-param">
                  <label class="bl__synth-lbl">Release</label>
                  <input type="range" class="bl__synth-range" min="0.01" max="4" step="0.01"
                    value={synthRelease()}
                    onInput={(e) => updateEnvelope(synthAttack(), synthDecay(), synthSustain(), +e.currentTarget.value)}
                  />
                  <span class="bl__synth-val">{synthRelease() < 0.1 ? `${Math.round(synthRelease() * 1000)}ms` : `${synthRelease().toFixed(2)}s`}</span>
                </div>
                <div class="bl__synth-param bl__synth-param--wide">
                  <label class="bl__synth-lbl">Cutoff</label>
                  <input type="range" class="bl__synth-range" min="100" max="8000" step="50"
                    value={synthFilterFreq()}
                    onInput={(e) => updateFilterFreq(+e.currentTarget.value)}
                  />
                  <span class="bl__synth-val">{synthFilterFreq() >= 1000 ? `${(synthFilterFreq() / 1000).toFixed(1)}kHz` : `${synthFilterFreq()}Hz`}</span>
                </div>
              </div>
            </div>
          </Show>

          <div class="bl__kb">
            {(() => {
              const startMidi = 12 * (octave() + 1); // C of current octave
              const totalNotes = 24; // 2 octaves
              const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(m % 12);
              const noteName = (m: number) => ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][m % 12];
              const KEY_LBL: Record<number, string> = {
                0:"A",1:"W",2:"S",3:"E",4:"D",5:"F",6:"T",7:"G",8:"Y",9:"H",10:"U",11:"J",
                12:"K",13:"O",14:"L",15:"P",16:";",
              };
              const notes = Array.from({ length: totalNotes }, (_, i) => startMidi + i);
              const t = tracks().find(tr => tr.id === selectedTrack());
              const preset = t?.type === "bass" ? "bass" : t?.type === "guitar" ? "guitar" : synthPreset();
              const isFretboard = preset === "guitar" || preset === "bass";
              const strings = preset === "bass"
                ? [43, 38, 33, 28] // G, D, A, E (top to bottom)
                : [64, 59, 55, 50, 45, 40]; // e, B, G, D, A, E
              
              if (isFretboard) {
                const strNames = preset === "bass"
                  ? ["G", "D", "A", "E"]
                  : ["e", "B", "G", "D", "A", "E"];
                const FRETS = Array.from({ length: 13 }, (_, i) => i);
                const SINGLE_DOTS = new Set([3, 5, 7, 9]);
                return (
                  <div class="bl__fretboard">
                    {/* String name labels */}
                    <div class="bl__fb-lblcol">
                      <For each={strNames}>{(n) => <div class="bl__fb-lbl">{n}</div>}</For>
                    </div>
                    {/* Neck body */}
                    <div class="bl__fb-neck">
                      {/* Fret-position dot row */}
                      <div class="bl__fb-dotrow">
                        <For each={FRETS}>
                          {(fret) => (
                            <div class={`bl__fb-dotcell${SINGLE_DOTS.has(fret) ? " has-dot" : ""}${fret === 12 ? " has-double" : ""}`} />
                          )}
                        </For>
                      </div>
                      {/* String rows */}
                      <For each={strings}>
                        {(openStr, sIdx) => (
                          <div class="bl__fb-row" data-sn={sIdx()}>
                            <For each={FRETS}>
                              {(fret) => {
                                const midi = openStr + fret;
                                return (
                                  <div
                                    class={`bl__fb-cell${fret === 0 ? " is-nut" : ""}${activeNotes().has(midi) ? " is-on" : ""}`}
                                    onMouseDown={() => pressKey(midi)}
                                    onMouseUp={() => releaseKey(midi)}
                                    onMouseLeave={() => activeNotes().has(midi) && releaseKey(midi)}
                                    onTouchStart={(e) => { e.preventDefault(); pressKey(midi); }}
                                    onTouchEnd={(e) => { e.preventDefault(); releaseKey(midi); }}
                                  />
                                );
                              }}
                            </For>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                );
              }
              return (
                <>
                  {/* white keys */}
                  <div class="bl__kb-whites">
                    <For each={notes.filter(m => !isBlack(m))}>
                      {(m) => (
                        <button
                          class={`bl__wk ${activeNotes().has(m) ? "is-on" : ""}`}
                          onMouseDown={() => pressKey(m)}
                          onMouseUp={() => releaseKey(m)}
                          onMouseLeave={() => activeNotes().has(m) && releaseKey(m)}
                          onTouchStart={(e) => { e.preventDefault(); pressKey(m); }}
                          onTouchEnd={(e) => { e.preventDefault(); releaseKey(m); }}
                        >
                          <span class="bl__wk-shortcut">{KEY_LBL[m - startMidi] ?? ""}</span>
                          <span class="bl__wk-name">{noteName(m)}{Math.floor(m/12)-1}</span>
                        </button>
                      )}
                    </For>
                  </div>
                  {/* black keys overlay */}
                  <div class="bl__kb-blacks">
                    <For each={notes.filter(m => !isBlack(m))}>
                      {(m, i) => {
                        const next = m + 1;
                        const hasBlack = isBlack(next);
                        return (
                          <div class="bl__bk-slot">
                            <Show when={hasBlack}>
                              <button
                                class={`bl__bk ${activeNotes().has(next) ? "is-on" : ""}`}
                                onMouseDown={(e) => { e.stopPropagation(); pressKey(next); }}
                                onMouseUp={(e) => { e.stopPropagation(); releaseKey(next); }}
                                onMouseLeave={() => activeNotes().has(next) && releaseKey(next)}
                                onTouchStart={(e) => { e.preventDefault(); pressKey(next); }}
                                onTouchEnd={(e) => { e.preventDefault(); releaseKey(next); }}
                              >
                                <span class="bl__bk-shortcut">{KEY_LBL[next - startMidi] ?? ""}</span>
                              </button>
                            </Show>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </>
              );
            })()}
          </div>

          <div class="bl__kb-hint">
            Type <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>… to play. <kbd>Z</kbd>/<kbd>X</kbd> change octave.
          </div>
        </section>
      </Show>

      {/* BOTTOM TAB BAR — shows panel tabs based on tracks in session */}
      <div class="bl__util">
        <div class="bl__util-l">
          {/* ── Drum tab ── */}
          <Show when={tracks().some(t => t.type === "drum")}>
            <button
              class={`bl__util-tab ${activePanel() === "drum" ? "is-active" : ""}`}
              onClick={() => setActivePanel(activePanel() === "drum" ? null : "drum")}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="8" rx="1.5"/><path d="M4 4v8M7 4v8M10 4v8"/></svg>
              <span>Drum Machine</span>
            </button>
            <Show when={tracks().some(t => t.type === "instrument" || t.type === "bass" || t.type === "guitar")}>
              <span class="bl__util-sep">·</span>
            </Show>
          </Show>

          {/* ── Instrument tab ── */}
          <Show when={tracks().some(t => t.type === "instrument" || t.type === "bass" || t.type === "guitar")}>
            <button
              class={`bl__util-tab ${activePanel() === "keys" ? "is-active" : ""}`}
              onClick={() => {
                if (activePanel() === "keys") { setActivePanel(null); return; }
                const instrTrack = tracks().find(t => t.type === "instrument" || t.type === "bass" || t.type === "guitar");
                const cur = tracks().find(t => t.id === selectedTrack());
                if (!cur || (cur.type !== "instrument" && cur.type !== "bass" && cur.type !== "guitar")) {
                  if (instrTrack) setSelectedTrack(instrTrack.id);
                }
                setActivePanel("keys");
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="8" rx="1"/><path d="M4 4v5M7 4v5M10 4v5M13 4v5"/><path d="M5.5 9v3M8.5 9v3M11.5 9v3"/></svg>
              <span>
                {(() => {
                  const t = tracks().find(tr => tr.id === selectedTrack());
                  if (t?.type === "bass") return "Bass";
                  if (t?.type === "guitar") return "Guitar";
                  return "Instrument";
                })()}
              </span>
            </button>
          </Show>

          {/* ── Context tools — always visible, light up based on active panel ── */}
          <span class="bl__util-sep">·</span>
          <button
            class={`bl__util-btn${activePanel() === "keys" ? " is-ctx" : ""}`}
            disabled={activePanel() !== "keys"}
            title="AutoPitch™ — tune your melodies automatically"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2 0 2-3 4-3s2 6 4 6 2-3 4-3"/></svg>
            <span>AutoPitch™</span>
          </button>
          <span class="bl__util-sep">·</span>
          {/* Fx — never goes away, always dim for now */}
          <button class="bl__util-btn" disabled>
            <span class="bl__util-fx">Fx</span>
            <span>Effects</span>
          </button>
          <span class="bl__util-sep">·</span>
          <button
            class={`bl__util-btn${activePanel() !== null ? " is-ctx" : ""}`}
            disabled={activePanel() === null}
            title="Piano roll / step editor"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9-3 1 1-3z"/><path d="M9 4l3 3"/></svg>
            <span>Editor</span>
          </button>
        </div>
        <div class="bl__util-r">
          <button class="bl__util-btn" disabled title="Write lyrics and session notes">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M3 7h10M3 10h6"/><path d="M12 10l2 2-2 2"/></svg>
            <span>Lyrics / Notes</span>
          </button>
          <span class="bl__util-sep">·</span>
          <button class="bl__util-btn" disabled>
            <span class="bl__util-flame">▶</span>
            <span>Melo Sounds</span>
          </button>
          <span class="bl__util-sep">·</span>
          <button class="bl__util-btn" disabled>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="12" height="6" rx="1"/><path d="M5 8h.01M8 8h.01M11 8h.01"/></svg>
            <span>Shortcuts</span>
          </button>
        </div>
      </div>

      {/* SIDE NAV DRAWER — editorial command menu */}
      <Show when={navOpen()}>
        {(() => {
          const close = () => setNavOpen(false);
          const run = (fn: () => void) => () => { fn(); close(); };
          const renamePrompt = () => { startEditingTitle(); };
          const bpmPrompt = () => {
            const next = window.prompt("Set BPM (40–240)", String(bpm()));
            const n = Number(next);
            if (Number.isFinite(n) && n >= 40 && n <= 240) {
              setBpm(Math.round(n));
              if (seq) seq.setBpm(Math.round(n));
            }
          };
          const CATS = [
            {
              id: "project" as const, num: "01", label: "Project",
              ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11V4l6-1.2v7"/><circle cx="5" cy="11.5" r="1.4"/><circle cx="11" cy="9.8" r="1.4"/></svg>,
              items: [
                { label: "New Project",   kbd: "⌘N",  action: run(() => navigate("/dashboard?new=1")) },
                { label: "Save",          kbd: "⌘S",  action: run(() => { void save(); }), disabled: () => saveState() === "saving" },
                { label: "Rename\u2026",  kbd: "",    action: run(renamePrompt) },
                { label: "Open Dashboard",kbd: "⌘D",  action: run(() => navigate("/dashboard")) },
              ],
            },
            {
              id: "edit" as const, num: "02", label: "Edit",
              ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9-3 1 1-3 9-9z"/><path d="M9 4l3 3"/></svg>,
              items: [
                { label: "Undo",            kbd: "⌘Z",   disabled: () => true },
                { label: "Redo",            kbd: "⌘⇧Z",  disabled: () => true },
                { label: "Delete Track",    kbd: "⌫",    action: run(() => { const id = selectedTrack(); if (id) deleteTrack(id); }), disabled: () => !selectedTrack() },
                { label: "Clear Pattern",   kbd: "",     action: run(() => setPattern(DEFAULT_PATTERN())) },
              ],
            },
            {
              id: "insert" as const, num: "03", label: "Insert",
              ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v10M3 8h10"/></svg>,
              items: [
                { label: "Add Track\u2026", kbd: "T", action: run(() => setShowNewTrack(true)) },
                { label: "Import Audio\u2026", kbd: "", disabled: () => true },
                { label: "Insert Pattern",     kbd: "", disabled: () => true },
              ],
            },
            {
              id: "view" as const, num: "04", label: "View",
              ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.2"/></svg>,
              items: [
                { label: "Toggle Drum Panel", kbd: "", action: run(() => setDrumPanelOpen(!drumPanelOpen())) },
                { label: "Toggle Mixer",      kbd: "", disabled: () => true },
                { label: "Fullscreen",        kbd: "F", action: run(() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }) },
              ],
            },
            {
              id: "transport" as const, num: "05", label: "Transport",
              ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l7 5-7 5z"/></svg>,
              items: [
                { label: () => playing() ? "Pause" : "Play", kbd: "Space", action: run(() => { void togglePlay(); }) },
                { label: "Stop",                              kbd: ".",     action: run(stopAll) },
                { label: "Set BPM\u2026",                     kbd: "",      action: run(bpmPrompt) },
              ],
            },
            {
              id: "help" as const, num: "06", label: "Help",
              ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.2"/><path d="M6 6.5a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6 1V10"/><circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none"/></svg>,
              items: [
                { label: "Keyboard Shortcuts", kbd: "?", disabled: () => true },
                { label: "About MeloStudio",   kbd: "",  disabled: () => true },
              ],
            },
          ];
          type Item = { label: string | (() => string); kbd: string; action?: () => void; disabled?: () => boolean };
          const active = () => CATS.find(c => c.id === navCat()) ?? CATS[0];
          return (
            <div class="bl__nav-overlay" onClick={close}>
              <aside class="bl__nav-drawer" onClick={(e) => e.stopPropagation()}>
                <div class="bl__nav-header">
                  <span class="bl__nav-eyebrow">— Menu</span>
                  <button class="bl__nav-x" onClick={close} aria-label="Close">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                  </button>
                </div>

                <div class="bl__nav-body">
                  <nav class="bl__nav-rail">
                    <For each={CATS}>{(c) => (
                      <button
                        class={`bl__nav-cat ${navCat() === c.id ? "is-active" : ""}`}
                        onMouseEnter={() => setNavCat(c.id)}
                        onFocus={() => setNavCat(c.id)}
                        onClick={() => setNavCat(c.id)}
                      >
                        <span class="bl__nav-num">{c.num}</span>
                        <span class="bl__nav-ico">{c.ico}</span>
                        <span class="bl__nav-label">{c.label}</span>
                        <svg class="bl__nav-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>
                      </button>
                    )}</For>
                  </nav>

                  <div class="bl__nav-pane-viewport">
                    <div
                      class="bl__nav-pane-track"
                      style={{ transform: `translateY(-${CATS.findIndex(c => c.id === navCat()) * 100}%)` }}
                    >
                      <For each={CATS}>{(cat) => (
                        <div class="bl__nav-pane">
                          <div class="bl__nav-pane-head">
                            <span class="bl__nav-pane-num">{cat.num} ·</span>
                            <span class="bl__nav-pane-title">{cat.label}</span>
                          </div>
                          <ul class="bl__nav-items">
                            <For each={cat.items as Item[]}>{(it) => {
                              const isDisabled = () => it.disabled?.() ?? !it.action;
                              const labelText = () => typeof it.label === "function" ? it.label() : it.label;
                              return (
                                <li>
                                  <button
                                    class="bl__nav-item"
                                    disabled={isDisabled()}
                                    onClick={() => !isDisabled() && it.action?.()}
                                  >
                                    <span class="bl__nav-item-label">{labelText()}</span>
                                    <Show when={it.kbd}><span class="bl__nav-kbd">{it.kbd}</span></Show>
                                  </button>
                                </li>
                              );
                            }}</For>
                          </ul>
                        </div>
                      )}</For>
                    </div>
                  </div>
                </div>

                <div class="bl__nav-foot">
                  <button class="bl__nav-exit" onClick={() => { close(); navigate("/dashboard"); }}>
                    <span class="bl__nav-exit-ico">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h5"/><path d="M11 5l-3 3 3 3M8 8h6"/></svg>
                    </span>
                    <span class="bl__nav-exit-text">
                      <span class="bl__nav-exit-label">Exit to</span>
                      <span class="bl__nav-exit-value">Dashboard</span>
                    </span>
                    <svg class="bl__nav-exit-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                  </button>
                  <div class="bl__nav-meta">
                    <span class="bl__nav-meta-key">Project</span>
                    <span class="bl__nav-meta-val">{name()}</span>
                  </div>
                </div>
              </aside>
            </div>
          );
        })()}
      </Show>

      {/* RESTORE SESSION DIALOG */}
      <Show when={showRestoreDialog()}>
        <div class="db__pm-overlay">
          <div class="db__pm" onClick={(e) => e.stopPropagation()}>
            <div class="db__pm-meta">
              <span>MeloStudio</span>
              <span class="db__pm-sep">/</span>
              <span>Studio</span>
              <span class="db__pm-sep">/</span>
              <strong>Session found</strong>
            </div>
            <div class="db__pm-display">
              <p class="db__pm-line">Restore</p>
              <p class="db__pm-line db__pm-line--pink">Session?</p>
            </div>
            <p style={{ "font-family": "var(--font-mono, monospace)", "font-size": "0.78rem", color: "var(--text-secondary)", "line-height": "1.65", "margin-top": "-0.5rem" }}>
              You have tracks, clips and beat patterns from a previous session.
              Restore to pick up where you left off, or start fresh.
            </p>
            <div class="db__pm-row">
              <button class="db__pm-btn db__pm-btn--primary" onClick={restoreSession}>
                Restore session
              </button>
              <button class="db__pm-btn db__pm-btn--ghost" onClick={discardSession}>
                Start fresh
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* NEW TRACK MODAL */}
      <Show when={showNewTrack()}>
        <div class="bl__overlay" onClick={() => setShowNewTrack(false)}>
          <div class="bl__modal" onClick={(e) => e.stopPropagation()}>
            <button class="bl__modal-close" onClick={() => setShowNewTrack(false)} aria-label="Close">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            </button>

            <div class="bl__modal-hero">
              <span class="bl__modal-eyebrow">— New Source / 06 options</span>
              <h2>What are you adding<br/>to the session?</h2>
              <p>Pick a sound source. Instruments are playable from your keyboard, audio sources record from your mic or input.</p>
            </div>

            <div class="bl__modal-section">
              <div class="bl__modal-section-head">
                <span class="bl__modal-section-num">I.</span>
                <span class="bl__modal-section-title">Instruments</span>
                <span class="bl__modal-section-rule" />
                <span class="bl__modal-section-meta">MIDI · playable</span>
              </div>
              <div class="bl__modal-rows">
                <For each={TRACK_DEFS.filter(d => d.tag === "MIDI" || d.tag === "RHYTHM")}>
                  {(def) => (
                    <button
                      class={`bl__nt ${def.ready ? "" : "is-locked"}`}
                      onClick={() => def.ready && addTrack(def.type)}
                      disabled={!def.ready}
                    >
                      <span class="bl__nt-icon" aria-hidden="true"><TrackIcon name={def.icon} /></span>
                      <span class="bl__nt-text">
                        <span class="bl__nt-title">
                          {def.label}
                          <Show when={!def.ready}><span class="bl__nt-soon">Soon</span></Show>
                        </span>
                        <span class="bl__nt-sub">{def.sub}</span>
                      </span>
                      <span class="bl__nt-arrow" aria-hidden="true">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div class="bl__modal-section">
              <div class="bl__modal-section-head">
                <span class="bl__modal-section-num">II.</span>
                <span class="bl__modal-section-title">Recording</span>
                <span class="bl__modal-section-rule" />
                <span class="bl__modal-section-meta">Audio · live input</span>
              </div>
              <div class="bl__modal-rows">
                <For each={TRACK_DEFS.filter(d => d.tag === "AUDIO")}>
                  {(def) => (
                    <button
                      class={`bl__nt ${def.ready ? "" : "is-locked"}`}
                      onClick={() => def.ready && addTrack(def.type)}
                      disabled={!def.ready}
                    >
                      <span class="bl__nt-icon" aria-hidden="true"><TrackIcon name={def.icon} /></span>
                      <span class="bl__nt-text">
                        <span class="bl__nt-title">
                          {def.label}
                          <Show when={!def.ready}><span class="bl__nt-soon">Soon</span></Show>
                        </span>
                        <span class="bl__nt-sub">{def.sub}</span>
                      </span>
                      <span class="bl__nt-arrow" aria-hidden="true">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                      </span>
                    </button>
                  )}
                </For>
                <button class="bl__nt is-import">
                  <span class="bl__nt-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"/><path d="M12 4v12M7 9l5-5 5 5"/></svg>
                  </span>
                  <span class="bl__nt-text">
                    <span class="bl__nt-title">Import file</span>
                    <span class="bl__nt-sub">Drop a .wav / .mp3 / .mid into the project</span>
                  </span>
                  <span class="bl__nt-arrow" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Studio;
