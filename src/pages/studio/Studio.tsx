import { type Component, createSignal, createEffect, onMount, onCleanup, For, Show, createMemo } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { authClient } from "~/lib/auth";
import { StepSequencer, DEFAULT_PATTERN, type StepPattern } from "~/lib/audio/stepSeq";
import { unlockAudioContext } from "~/lib/audio/context";
import { PolySynth, type SynthPreset } from "~/lib/audio/synth";
import { updateProjectApi } from "~/lib/api";
import "./studio.scss";

type TrackType = "drum" | "voice" | "instrument" | "sampler" | "bass" | "guitar";

interface UITrack {
  id: string;
  name: string;
  type: TrackType;
  muted: boolean;
  solo: boolean;
  volume: number; // 0..1
  pan: number;    // -1..1
  color: string;
}

const TRACK_DEFS: { type: TrackType; label: string; sub?: string; tag: string; ready: boolean; icon: string }[] = [
  { type: "instrument", label: "Instrument",   sub: "Piano, lead, pad, plucks — playable from your keyboard",   tag: "MIDI",     ready: true,  icon: "instrument" },
  { type: "drum",       label: "Drum Machine", sub: "Step-sequenced kit · ready in seconds",                    tag: "RHYTHM",   ready: true,  icon: "drum"       },
  { type: "bass",       label: "Bass Synth",   sub: "Deep monophonic bass — keyboard playable",                 tag: "MIDI",     ready: true,  icon: "bass"       },
  { type: "voice",      label: "Voice / Audio",sub: "Capture vocals or any external sound source",              tag: "AUDIO",    ready: false, icon: "voice"      },
  { type: "sampler",    label: "Sampler",      sub: "Turn any audio clip into a playable instrument",           tag: "MIDI",     ready: false, icon: "sampler"    },
  { type: "guitar",     label: "Guitar",       sub: "Acoustic & Electric Guitars — keyboard playable",          tag: "MIDI",     ready: true,  icon: "guitar"     },
];

const DRUM_LABEL: Record<string, string> = {
  kick: "Kick", snare: "Snare", hat_closed: "Hi-Hat", hat_open: "Open Hat", clap: "Clap",
};

const fmtTime = (sec: number): string => {
  if (sec < 0 || !isFinite(sec)) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
};

/* Editorial line-icons for the New Track modal */
const TrackIcon: Component<{ name: string }> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <Show when={props.name === "instrument"}>
      <rect x="3" y="6" width="18" height="12" rx="1.2" />
      <path d="M7 6v8M11 6v8M15 6v8" />
      <rect x="5.5" y="14" width="3" height="4" rx="0.4" fill="currentColor" stroke="none" />
      <rect x="13.5" y="14" width="3" height="4" rx="0.4" fill="currentColor" stroke="none" />
    </Show>
    <Show when={props.name === "drum"}>
      <ellipse cx="12" cy="8" rx="8" ry="2.4" />
      <path d="M4 8v6c0 1.3 3.6 2.4 8 2.4s8-1.1 8-2.4V8" />
      <path d="M9 9.5l-3 9M15 9.5l3 9" />
    </Show>
    <Show when={props.name === "bass"}>
      <path d="M14 4l3 3" />
      <path d="M16 6l-9 9a3 3 0 1 1-2-2l9-9 2 2z" />
      <circle cx="6.5" cy="17.5" r="1" fill="currentColor" stroke="none" />
    </Show>
    <Show when={props.name === "voice"}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M9 21h6" />
    </Show>
    <Show when={props.name === "sampler"}>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M7 14l2-4 2 7 2-9 2 6 2-3" />
    </Show>
    <Show when={props.name === "guitar"}>
      <path d="M14 4l4 4" />
      <path d="M17 5l2 2" />
      <path d="M16 7l-7 7a4 4 0 1 1-2-2l7-7 2 2z" />
      <circle cx="8" cy="15" r="1.5" />
    </Show>
  </svg>
);

const Studio: Component = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  let seq: StepSequencer | null = null;
  let synth: PolySynth | null = null;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  const heldKeys = new Set<string>();

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
  const [navOpen, setNavOpen] = createSignal(false);
  const [navCat, setNavCat] = createSignal<"project" | "edit" | "insert" | "view" | "transport" | "help">("project");
  const [titleEditing, setTitleEditing] = createSignal(false);
  let titleInputEl: HTMLInputElement | undefined;
  const [drumPanelOpen, setDrumPanelOpen] = createSignal(true);
  const [synthPreset, setSynthPreset] = createSignal<SynthPreset>("piano");
  const [octave, setOctave] = createSignal(4);

  // Sync the synth preset whenever the selected track changes.
  // Bass tracks always use the "bass" preset; switching back to an
  // instrument track restores a non-bass preset.
  createEffect(() => {
    const t = tracks().find(tr => tr.id === selectedTrack());
    if (!t) return;
    if (t.type === "bass") {
      if (synthPreset() !== "bass") {
        setSynthPreset("bass");
        synth?.setPreset("bass");
      }
    } else if (t.type === "guitar") {
      if (synthPreset() !== "guitar") {
        setSynthPreset("guitar");
        synth?.setPreset("guitar");
      }
    } else if (t.type === "instrument") {
      if (synthPreset() === "bass" || synthPreset() === "guitar") {
        setSynthPreset("piano");
        synth?.setPreset("piano");
      }
    }
  });
  const [activeNotes, setActiveNotes] = createSignal<Set<number>>(new Set());

  const userId = async (): Promise<string | null> => {
    const { data } = await authClient.getSession();
    return data?.user?.id ?? null;
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
      setName(doc.name ?? "Untitled");
      if (doc.transport?.bpm) setBpm(doc.transport.bpm);

      const pat: StepPattern | undefined = doc.beat?.pattern;
      if (pat?.rows?.length) {
        setPattern(pat);
        seq!.setPattern(pat);
        if (pat.bpm) setBpm(pat.bpm);
      }

      // Restore persisted UI tracks
      const savedTracks: UITrack[] | undefined = (doc as any).uiTracks;
      if (savedTracks?.length) {
        const restoredTracks: UITrack[] = [];
        for (const t of savedTracks) {
          if (!TRACK_DEFS.find(d => d.type === t.type)?.ready) continue;
          restoredTracks.push(t);
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
        if (hasDrum && pat?.rows?.length) seq!.setPattern(pat);
        if (hasDrum) setDrumPanelOpen(true);
      } else if (pat?.rows?.length) {
        // legacy: doc has a pattern but no uiTracks — restore drum track only
        addTrack("drum", false);
      }
      
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("new") === "1") {
        setShowAddMenu(true);
        
        // Clean up the URL so reloads don't pop it up again
        searchParams.delete("new");
        const newUrl = window.location.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
        window.history.replaceState({}, "", newUrl);
      }
    } catch (err) {
      setError(String(err));
    }
  });

  // ───── Synth & keyboard ─────
  const ensureSynth = (preset: SynthPreset = "piano") => {
    if (!synth) synth = new PolySynth(preset);
    else synth.setPreset(preset);
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
    ensureSynth(synthPreset());
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
    ensureSynth(synthPreset());
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
      color: def.color,
    };
    setTracks([...tracks(), t]);
    setSelectedTrack(t.id);
    if (type === "drum") setDrumPanelOpen(true);
    if (openModal) setShowNewTrack(false);
  };

  const deleteTrack = (id: string) => {
    setTracks(tracks().filter(t => t.id !== id));
    if (selectedTrack() === id) setSelectedTrack(null);
  };

  const patchTrack = (id: string, patch: Partial<UITrack>) => {
    setTracks(tracks().map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const togglePlay = async () => {
    if (!seq) return;
    await unlockAudioContext();
    if (playing()) {
      seq.stop();
      setPlaying(false);
      if (elapsedTimer) clearInterval(elapsedTimer);
      elapsedTimer = null;
    } else {
      await seq.start();
      setPlaying(true);
      startTime = performance.now();
      elapsedTimer = setInterval(() => setElapsed((performance.now() - startTime) / 1000), 50);
    }
  };

  const stopAll = () => {
    if (!seq) return;
    seq.stop();
    setPlaying(false);
    setElapsed(0);
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = null;
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
    setPattern({ ...p, rows: p.rows.map(r => ({ ...r, velocities: [...r.velocities] })) });
  };

  const clearPattern = () => {
    if (!seq) return;
    seq.getPattern().rows.forEach((_, i) => seq!.clearRow(i));
    const p = seq.getPattern();
    setPattern({ ...p, rows: p.rows.map(r => ({ ...r, velocities: [...r.velocities] })) });
  };

  const setMasterVolume = (v: number) => {
    setMasterVol(v);
    if (seq) {
      // map 0..1 → -60..0 db
      const db = v <= 0.001 ? -60 : 20 * Math.log10(v);
      seq.setMasterGainDb(db);
    }
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
      const updated = {
        ...doc,
        beat: { pattern: seq.getPattern() },
        transport: { ...(doc.transport ?? {}), bpm: bpm() },
        uiTracks: tracks(),
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
  const onWinMouseMove = (e: MouseEvent) => {
    if (!dragState || !timelineEl) return;
    timelineEl.scrollLeft = dragState.scroll - (e.clientX - dragState.x);
  };
  const onWinMouseUp = () => {
    if (!dragState) return;
    dragState = null;
    document.body.style.cursor = "";
  };
  onMount(() => {
    window.addEventListener("mousemove", onWinMouseMove);
    window.addEventListener("mouseup", onWinMouseUp);
  });
  onCleanup(() => {
    window.removeEventListener("mousemove", onWinMouseMove);
    window.removeEventListener("mouseup", onWinMouseUp);
  });

  // Compute clip block style for drum row
  const drumClipBars = createMemo(() => {
    // Each pattern is 1 bar long; show as repeated block while playing
    const totalBars = 4; // visible loop length
    return Array.from({ length: totalBars }, (_, i) => i);
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
                  onClick={() => setSelectedTrack(t.id)}
                >
                  <div class="bl__track-bar" style={{ background: t.color }} />
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
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                      </button>
                    </div>
                    <div class="bl__track-controls" onClick={(e) => e.stopPropagation()}>
                      <button
                        class={`bl__chip-btn ${t.muted ? "is-on-mute" : ""}`}
                        onClick={() => patchTrack(t.id, { muted: !t.muted })}
                      >M</button>
                      <button
                        class={`bl__chip-btn ${t.solo ? "is-on-solo" : ""}`}
                        onClick={() => patchTrack(t.id, { solo: !t.solo })}
                      >S</button>
                      <input
                        class="bl__slider"
                        type="range" min="0" max="1" step="0.01"
                        value={t.volume}
                        onInput={(e) => patchTrack(t.id, { volume: parseFloat(e.currentTarget.value) })}
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
          {/* Ruler */}
          <div class="bl__ruler">
            <For each={bars}>
              {(b) => (
                <div class="bl__bar">
                  <span class="bl__bar-num">{b}</span>
                </div>
              )}
            </For>
          </div>

          {/* Track lanes */}
          <div class="bl__lanes">
            <Show when={tracks().length === 0}>
              <div class="bl__stage-empty">
                <div class="bl__stage-empty-card">
                  <span class="bl__stage-empty-eyebrow">Empty session</span>
                  <h2 class="bl__stage-empty-title">Your canvas awaits</h2>
                  <p class="bl__stage-empty-sub">Add a track from the panel on the left, drop in a loop, or let AutoMix get you started.</p>
                  <div class="bl__stage-empty-actions">
                    <button class="bl__btn-pink" onClick={() => setShowNewTrack(true)}>+ Add a track</button>
                    <button class="bl__btn-ghost" onClick={() => addTrack("drum")}>Drum machine</button>
                  </div>
                </div>
              </div>
            </Show>

            <For each={tracks()}>
              {(t) => (
                <div class={`bl__lane ${selectedTrack() === t.id ? "is-sel" : ""}`}>
                  <Show when={t.type === "drum"}>
                    <For each={drumClipBars()}>
                      {(barIdx) => (
                        <div
                          class="bl__clip"
                          style={{ left: `${barIdx * 80}px`, width: "78px", background: t.color }}
                        >
                          <span class="bl__clip-name">Drums</span>
                          <div class="bl__clip-wave">
                            <For each={pattern().rows[0]?.velocities ?? []}>
                              {(v) => <div class="bl__clip-tick" classList={{ "is-hit": v > 0 }} />}
                            </For>
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              )}
            </For>
          </div>

          {/* Playhead */}
          <Show when={playing()}>
            <div
              class="bl__playhead"
              style={{ left: `${currentStep() < 0 ? 0 : (currentStep() / 16) * 80}px` }}
            />
          </Show>
        </section>
      </div>

      {/* DRUM MACHINE PANEL */}
      <Show when={drumPanelOpen() && tracks().some(t => t.type === "drum")}>
        <section class="bl__drum-panel">
          <div class="bl__dp-head">
            <div class="bl__dp-title">
              <span class="bl__dp-icon" style={{ color: "#f5b53e", display: "flex", "align-items": "center", "justify-content": "center" }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4c-4.4 0-8 1.6-8 3.5s3.6 3.5 8 3.5 8-1.6 8-3.5-3.6-3.5-8-3.5z"/><path d="M4 7.5v9c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-9"/><path d="M12 11v6"/></svg>
              </span>
              <span>Drum Machine</span>
              <span class="bl__dp-step">{currentStep() < 0 ? "—" : `Step ${currentStep() + 1}/16`}</span>
            </div>
            <div class="bl__dp-actions">
              <button class="bl__btn-ghost" onClick={clearPattern}>Clear</button>
              <button class="bl__icon-btn" onClick={() => setDrumPanelOpen(false)} title="Collapse">−</button>
            </div>
          </div>

          <div class="bl__dp-grid">
            <For each={pattern().rows}>
              {(row, rowIdx) => (
                <div class="bl__dp-row">
                  <div class="bl__dp-rowlabel">
                    <span class="bl__dp-rowname">{DRUM_LABEL[row.drum] ?? row.drum}</span>
                  </div>
                  <div class="bl__dp-cells">
                    <For each={row.velocities}>
                      {(v, stepIdx) => (
                        <button
                          class={[
                            "bl__dp-cell",
                            v > 0 ? "is-on" : "",
                            currentStep() === stepIdx() ? "is-cursor" : "",
                            stepIdx() % 4 === 0 ? "is-down" : "",
                          ].filter(Boolean).join(" ")}
                          onClick={() => toggleStep(rowIdx(), stepIdx())}
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
      <Show when={(() => {
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

      {/* BOTTOM UTILITY BAR */}
      <div class="bl__util">
        <div class="bl__util-l">
          <button class="bl__util-btn" disabled>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2 0 2-3 4-3s2 6 4 6 2-3 4-3"/></svg>
            <span>AutoPitch™</span>
          </button>
          <span class="bl__util-sep">·</span>
          <button class="bl__util-btn" disabled>
            <span class="bl__util-fx">Fx</span>
            <span>Effects</span>
          </button>
          <span class="bl__util-sep">·</span>
          <button class="bl__util-btn" disabled>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9-3 1 1-3z"/><path d="M9 4l3 3"/></svg>
            <span>Editor</span>
          </button>
        </div>
        <div class="bl__util-r">
          <button class="bl__util-btn" disabled>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9-3 1 1-3z"/></svg>
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
