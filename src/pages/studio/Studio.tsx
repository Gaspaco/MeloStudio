import { type Component, createSignal, createMemo, createEffect, onMount, onCleanup, Show } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import type * as ToneNs from "tone";

let Tone: typeof ToneNs | undefined;
const getTone = async () => {
  if (!Tone) Tone = await import("tone");
  return Tone;
};
import { StepSequencer, DEFAULT_PATTERN, type StepPattern } from "~/lib/audio/stepSeq";
import { type SynthPreset } from "~/lib/audio/synth";
import { getMasterBus } from "~/lib/audio/masterBus";
import { unlockAudioContext } from "~/lib/audio/context";
import { updateProjectApi, sendHeartbeat } from "~/lib/api";
import { getAppSession } from "~/lib/app-auth";
import { type TrackType, type UITrack, PRESET_ADSR, TEMPLATES, hasStudioContent } from "./types";
import { useProject }   from "./hooks/useProject";
import { useTransport } from "./hooks/useTransport";
import { useDrum }      from "./hooks/useDrum";
import { useSynth }     from "./hooks/useSynth";
import { useTracks }    from "./hooks/useTracks";
import TopBar           from "./components/TopBar";
import TracksSidebar    from "./components/TracksSidebar";
import TimelineArea     from "./components/TimelineArea";
import BottomBar        from "./components/BottomBar";
import LyricsPanel      from "./components/LyricsPanel";
import RestoreDialog    from "./components/RestoreDialog";
import DrumPanel        from "./components/DrumPanel";
import KeyboardPanel    from "./components/KeyboardPanel";
import NavDrawer, { type NavCategory } from "./components/NavDrawer";
import NewTrackModal    from "./components/NewTrackModal";

import "./studio.scss";

const Studio: Component = () => {
  const params   = useParams<{ id: string }>();
  const navigate = useNavigate();

  let seq: StepSequencer | null = null;
  let timelineElRef: HTMLDivElement | undefined;
  let titleInputEl: HTMLInputElement | undefined;

  const [name,               setName]               = createSignal("New Project");
  const [tracks,             setTracks]             = createSignal<UITrack[]>([]);
  const [selectedTrack,      setSelectedTrack]      = createSignal<string | null>(null);
  const [pattern,            setPattern]            = createSignal<StepPattern>(DEFAULT_PATTERN());
  const [bpm,                setBpm]                = createSignal(100);
  const [playing,            setPlaying]            = createSignal(false);
  const [currentStep,        setCurrentStep]        = createSignal(-1);
  const [elapsed,            setElapsed]            = createSignal(0);
  const [masterVol,          setMasterVol]          = createSignal(0.8);
  const [saveState,          setSaveState]          = createSignal<"idle" | "saving" | "saved">("idle");
  const [lastSaved,          setLastSaved]          = createSignal<Date | null>(null);
  const [showSaveToast,      setShowSaveToast]      = createSignal(false);
  const [timeSig,            setTimeSig]            = createSignal<[number, number]>([4, 4]);
  const [musicalKey,         setMusicalKey]         = createSignal("Auto");
  const [error,              setError]              = createSignal("");
  const [showNewTrack,       setShowNewTrack]       = createSignal(false);
  const [showAddMenu,        setShowAddMenu]        = createSignal(false);
  const [showRestoreDialog,  setShowRestoreDialog]  = createSignal(false);
  const [navOpen,            setNavOpen]            = createSignal(false);
  const [navCat,             setNavCat]             = createSignal<"project" | "edit" | "insert" | "view" | "transport" | "help">("project");
  const [lyricsOpen,         setLyricsOpen]         = createSignal(false);
  const [lyricsText,         setLyricsText]         = createSignal("");
  const [titleEditing,       setTitleEditing]       = createSignal(false);
  const [drumPanelOpen,      setDrumPanelOpen]      = createSignal(true);
  const [activePanel,        setActivePanel]        = createSignal<"drum" | "keys" | null>(null);
  const [drumSwing,          setDrumSwing]          = createSignal(0);
  const [drumSteps,          setDrumSteps]          = createSignal(16);
  const [synthPreset,        setSynthPreset]        = createSignal<SynthPreset>("piano");
  const [octave,             setOctave]             = createSignal(4);
  const [synthAttack,        setSynthAttack]        = createSignal<number>(PRESET_ADSR.lead.attack);
  const [synthDecay,         setSynthDecay]         = createSignal<number>(PRESET_ADSR.lead.decay);
  const [synthSustain,       setSynthSustain]       = createSignal<number>(PRESET_ADSR.lead.sustain);
  const [synthRelease,       setSynthRelease]       = createSignal<number>(PRESET_ADSR.lead.release);
  const [synthFilterFreq,    setSynthFilterFreq]    = createSignal<number>(PRESET_ADSR.lead.filterFreq);
  const [activeNotes,        setActiveNotes]        = createSignal<Set<number>>(new Set());
  const [playheadPx,         setPlayheadPx]         = createSignal(0);
  const [enhance,            setEnhance]            = createSignal(true);
  const [metronomeOn,        setMetronomeOn]        = createSignal(false);
  const [loopOn,             setLoopOn]             = createSignal(false);
  const [published,          setPublished]          = createSignal(false);

  const [userImage,          setUserImage]          = createSignal<string | null>(null);

  // ── Undo / Redo history ───────────────────────────────────────────────────
  type HistorySnap = { tracks: UITrack[]; pattern: StepPattern; bpm: number };
  let historyStack: HistorySnap[] = [];
  let historyIndex = -1;
  const MAX_HISTORY = 50;

  const snapHistory = () => {
    const snap: HistorySnap = {
      tracks: JSON.parse(JSON.stringify(tracks())),
      pattern: JSON.parse(JSON.stringify(pattern())),
      bpm: bpm(),
    };
    // Discard future if we branched
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(snap);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    historyIndex = historyStack.length - 1;
  };

  // Timestamp lock: applySnap locks for 600ms so the 400ms debounce that fires
  // due to its own signal changes can't snapshot and wipe the redo stack.
  let snapLockUntil = 0;
  const applySnap = (snap: HistorySnap) => {
    if (snapTimer) { clearTimeout(snapTimer); snapTimer = undefined; }
    snapLockUntil = Date.now() + 600;
    setTracks(snap.tracks);
    setPattern(snap.pattern);
    setBpm(snap.bpm);
    seq?.setBpm(snap.bpm);
    seq?.setPattern(snap.pattern);
  };

  const canUndo = () => historyIndex > 0;
  const canRedo = () => historyIndex < historyStack.length - 1;

  const undo = () => {
    if (!canUndo()) return;
    historyIndex--;
    const snap = historyStack[historyIndex];
    if (snap) applySnap(snap);
  };

  const redo = () => {
    if (!canRedo()) return;
    historyIndex++;
    const snap = historyStack[historyIndex];
    if (snap) applySnap(snap);
  };

  const sth = useSynth({
    tracks, selectedTrack, masterVol,
    synthPreset, setSynthPreset, octave, setOctave,
    activeNotes, setActiveNotes,
    setSynthAttack, setSynthDecay, setSynthSustain, setSynthRelease,
    setSynthFilterFreq, setActivePanel,
  });

  const transport = useTransport({
    getSeq: () => seq, getSynth: sth.getSynth,
    tracks, bpm, setBpm, playing, setPlaying,
    elapsed, setElapsed, masterVol, setMasterVol,
    playheadPx, setPlayheadPx, pattern, setPattern,
    loopEnabled: loopOn,
  });

  const drum = useDrum({
    getSeq: () => seq, pattern, setPattern,
    drumSwing, setDrumSwing, drumSteps, setDrumSteps,
  });

  const project = useProject({
    projectId: params.id, navigate,
    getSeq: () => seq, ensureSynth: sth.ensureSynth,
    name, setName, tracks, setTracks, selectedTrack, setSelectedTrack,
    bpm, setBpm, timeSig, setTimeSig, musicalKey, setMusicalKey,
    pattern, setPattern,
    synthPreset, setSynthPreset,
    setDrumPanelOpen, setShowNewTrack,
    saveState, setSaveState, setError, setShowRestoreDialog,
    setPublished,
    lyricsText, setLyricsText,
  });

  const trk = useTracks({
    projectId: () => params.id,
    tracks, setTracks, selectedTrack, setSelectedTrack,
    bpm, setError, setShowNewTrack,
    ensureSynth: sth.ensureSynth, setSynthPreset,
    setActivePanel, setDrumPanelOpen,
    getSeq: () => seq, getSynth: sth.getSynth,
    setTrackVolume: transport.setTrackVolume,
    save: project.save,
    timelineEl: () => timelineElRef,
  });

  const canSaveProject = () => hasStudioContent(tracks(), pattern(), lyricsText());

  onMount(async () => {
    seq = new StepSequencer();
    seq.onStep = (i) => setCurrentStep(i);
    await project.init();

    // Fetch user avatar for the save toast
    try {
      const img = (await getAppSession())?.user?.image ?? undefined;
      if (img) setUserImage(img);
    } catch { /* non-critical */ }
    // Seed initial history snapshot once the project is loaded
    snapHistory();

    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      } else if ((e.metaKey || e.ctrlKey) && (e.shiftKey && e.key === "z" || e.key === "y")) {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    onCleanup(() => window.removeEventListener("keydown", handleGlobalKey));

  });

  onCleanup(() => {
    seq?.stop();
    sth.allNotesOff();
    metronomePart?.dispose();
    if (canSaveProject() && Date.now() - lastSavedAt > 5_000) {
      project.save().catch(() => {});
    }
  });

  // ── Studio time heartbeat (60s while tab is visible) ──────────────────────
  {
    let hbInterval: ReturnType<typeof setInterval> | undefined;
    const startHb = () => {
      if (hbInterval) return;
      sendHeartbeat(params.id);
      hbInterval = setInterval(() => sendHeartbeat(params.id), 60_000);
    };
    const stopHb = () => {
      if (hbInterval) { clearInterval(hbInterval); hbInterval = undefined; }
    };
    const onVis = () => document.hidden ? stopHb() : startHb();
    onMount(() => {
      startHb();
      document.addEventListener("visibilitychange", onVis);
    });
    onCleanup(() => {
      stopHb();
      document.removeEventListener("visibilitychange", onVis);
    });
  }

  // ── Metronome ─────────────────────────────────────────────────────────────
  let metronomePart: ToneNs.Part | null = null;

  const playMetronomeClick = async (time: number, isDownbeat: boolean) => {
    const T = await getTone();
    const ac = T.getContext().rawContext as AudioContext;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.frequency.value = isDownbeat ? 1800 : 1200;
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.start(time);
    osc.stop(time + 0.05);
  };

  const startMetronome = async () => {
    const T = await getTone();
    metronomePart?.dispose();
    const [num] = timeSig();
    metronomePart = new T.Part((time: number, ev: unknown) => {
      const beat = (ev as { beat: number }).beat;
      playMetronomeClick(time, beat === 0);
    }, Array.from({ length: num }, (_, i) => [`${i}*4n`, { beat: i }]));
    metronomePart.loop = true;
    metronomePart.loopEnd = `${timeSig()[0]}*4n`;
    metronomePart.start(0);
  };

  const stopMetronome = () => {
    metronomePart?.stop();
    metronomePart?.dispose();
    metronomePart = null;
  };

  const toggleMetronome = async () => {
    const next = !metronomeOn();
    setMetronomeOn(next);
    if (next && playing()) {
      await unlockAudioContext();
      startMetronome();
    } else {
      stopMetronome();
    }
  };

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(toastTimer));
  let lastSavedAt = 0;
  const handleSave = async () => {
    if (!canSaveProject()) return;
    await project.save();
    lastSavedAt = Date.now();
    setLastSaved(new Date());
    setShowSaveToast(true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setShowSaveToast(false), 6000);
  };

  // Auto-snapshot: debounced 400ms after any real user change.
  // Skipped if still inside the applySnap lock window (undo/redo applied < 600ms ago).
  let snapTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(snapTimer));
  const scheduleSnap = () => {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      snapTimer = undefined;
      if (Date.now() >= snapLockUntil) snapHistory();
    }, 400);
  };
  createEffect(() => {
    JSON.stringify(tracks());
    JSON.stringify(pattern());
    bpm();
    scheduleSnap();
  });

  const startEditingTitle = () => {
    setTitleEditing(true);
    queueMicrotask(() => { titleInputEl?.focus(); titleInputEl?.select(); });
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

  const applyTemplate = (templateId: string) => {
    const tmpl = TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;
    transport.updateBpm(tmpl.bpm);
    const base = DEFAULT_PATTERN();
    base.bpm = tmpl.bpm;
    if (tmpl.pattern) {
      for (const row of base.rows) {
        const vels = tmpl.pattern[row.drum];
        if (vels) row.velocities = [...vels];
      }
    }
    setPattern(base);
    seq?.setPattern(base);
    trk.addTrackBatch(tmpl.tracks);
  };

  const adsrPath = createMemo(() => {
    const a = Math.max(0.001, synthAttack());
    const d = Math.max(0.001, synthDecay());
    const s = synthSustain();
    const r = Math.max(0.001, synthRelease());
    const hold = 0.5, W = 200, H = 52;
    const total = a + d + hold + r;
    const aw = (a / total) * W;
    const dw = (d / total) * W;
    const sw = (hold / total) * W;
    const sy = 2 + (1 - s) * (H - 4);
    const stroke = `M0,${H} L${aw.toFixed(1)},2 L${(aw+dw).toFixed(1)},${sy.toFixed(1)} L${(aw+dw+sw).toFixed(1)},${sy.toFixed(1)} L${W},${H}`;
    return { stroke, fill: `${stroke} Z` };
  });

  const drumClipBars = createMemo(() => Array.from({ length: 4 }, (_, i) => i));

  const saveAndNavigate = async (path: string) => {
    if (canSaveProject()) await handleSave();
    navigate(path);
  };

  const buildNavCats = (): NavCategory[] => {
    const close = () => setNavOpen(false);
    const run = (fn: () => void) => () => { fn(); close(); };
    return [
      {
        id: "project", num: "01", label: "Project",
        ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11V4l6-1.2v7"/><circle cx="5" cy="11.5" r="1.4"/><circle cx="11" cy="9.8" r="1.4"/></svg>,
        items: [
          { label: "New Project",    kbd: "⌘N", action: run(() => { void saveAndNavigate("/dashboard?new=1"); }) },
          { label: "Save",           kbd: "⌘S", action: run(() => { void handleSave(); }), disabled: () => saveState() === "saving" || !canSaveProject() },
          { label: "Rename\u2026",   kbd: "",   action: run(() => startEditingTitle()) },
          { label: "Open Dashboard", kbd: "⌘D", action: run(() => { void saveAndNavigate("/dashboard"); }) },
        ],
      },
      {
        id: "edit", num: "02", label: "Edit",
        ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9-3 1 1-3 9-9z"/><path d="M9 4l3 3"/></svg>,
        items: [
          { label: "Undo",          kbd: "⌘Z",  action: run(() => undo()),  disabled: () => !canUndo() },
          { label: "Redo",          kbd: "⌘⇧Z", action: run(() => redo()),  disabled: () => !canRedo() },
          { label: "Delete Track",  kbd: "⌫",   action: run(() => { const id = selectedTrack(); if (id) trk.deleteTrack(id); }), disabled: () => !selectedTrack() },
          { label: "Clear Pattern", kbd: "",    action: run(() => drum.clearPattern()) },
        ],
      },
      {
        id: "insert", num: "03", label: "Insert",
        ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v10M3 8h10"/></svg>,
        items: [
          { label: "Add Track\u2026",    kbd: "T", action: run(() => setShowNewTrack(true)) },
          { label: "Import Audio\u2026", kbd: "",  disabled: () => true },
          { label: "Insert Pattern",     kbd: "",  disabled: () => true },
        ],
      },
      {
        id: "view", num: "04", label: "View",
        ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.2"/></svg>,
        items: [
          { label: "Toggle Drum Panel", kbd: "", action: run(() => setDrumPanelOpen(!drumPanelOpen())) },
          { label: "Toggle Mixer",      kbd: "", disabled: () => true },
          { label: "Fullscreen",        kbd: "F", action: run(() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }) },
        ],
      },
      {
        id: "transport", num: "05", label: "Transport",
        ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l7 5-7 5z"/></svg>,
        items: [
          { label: () => playing() ? "Pause" : "Play", kbd: "Space", action: run(() => { void transport.togglePlay(); }) },
          { label: "Stop",          kbd: ".", action: run(transport.stopAll) },
          { label: "Set BPM\u2026", kbd: "", action: run(() => {
              const next = window.prompt("Set BPM (40–240)", String(bpm()));
              const n = Number(next);
              if (Number.isFinite(n) && n >= 40 && n <= 240) transport.updateBpm(Math.round(n));
            }),
          },
        ],
      },
      {
        id: "help", num: "06", label: "Help",
        ico: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.2"/><path d="M6 6.5a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6 1V10"/><circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none"/></svg>,
        items: [
          { label: "Keyboard Shortcuts", kbd: "?", disabled: () => true },
          { label: "About MeloStudio",   kbd: "",  disabled: () => true },
        ],
      },
    ];
  };

  return (
    <div class="bl">
      <TopBar
        name={name} titleEditing={titleEditing} saveState={saveState} lastSaved={lastSaved}
        bpm={bpm} meter={timeSig} musicalKey={musicalKey}
        playing={playing} elapsed={elapsed} masterVol={masterVol}
        titleInputRef={(el) => (titleInputEl = el)}
        onNavToggle={() => setNavOpen(!navOpen())}
        onDashboard={() => { void saveAndNavigate("/dashboard"); }}
        onStartEditTitle={startEditingTitle}
        onCommitTitle={commitTitle}
        onCancelTitle={cancelTitle}
        onSave={handleSave}
        canSave={canSaveProject}
        canUndo={canUndo} canRedo={canRedo}
        onUndo={undo} onRedo={redo}
        metronomeOn={metronomeOn} onToggleMetronome={toggleMetronome}
        loopOn={loopOn} onToggleLoop={() => setLoopOn(v => !v)}
        onTogglePlay={async () => {
          await transport.togglePlay();
          // Start/stop metronome to stay in sync with playback
          if (metronomeOn()) {
            if (!playing()) stopMetronome();
            else { await unlockAudioContext(); startMetronome(); }
          }
        }}
        onStopAll={transport.stopAll}
        onUpdateBpm={transport.updateBpm}
        onUpdateMeter={setTimeSig}
        onUpdateKey={setMusicalKey}
        onSetMasterVol={transport.setMasterVolume}
        onElapsedReset={() => setElapsed(0)}
        enhance={enhance}
        onToggleEnhance={() => {
          const next = !enhance();
          setEnhance(next);
          getMasterBus().setEnhanced(next);
        }}
        published={published}
        onPublish={() => navigate(`/publish/${params.id}`)}
      />

      <Show when={error()}>
        <div class="bl__toast">{error()}</div>
      </Show>

      <Show when={showSaveToast()}>
        <div class="bl__save-toast">
          <div class="bl__save-toast-thumb">
            <Show
              when={userImage()}
              keyed
              fallback={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="4"  y1="12" x2="4"  y2="12"/>
                  <line x1="8"  y1="8"  x2="8"  y2="16"/>
                  <line x1="12" y1="4"  x2="12" y2="20"/>
                  <line x1="16" y1="9"  x2="16" y2="15"/>
                  <line x1="20" y1="11" x2="20" y2="13"/>
                </svg>
              }
            >
              {(image) => <img src={image} alt="" />}
            </Show>
          </div>
          <div class="bl__save-toast-body">
            <span class="bl__save-toast-title">Project saved</span>
            <a class="bl__save-toast-link" href={`/share/${params.id}`}>View Revision</a>
          </div>
          <button class="bl__save-toast-close" onClick={() => setShowSaveToast(false)} aria-label="Dismiss">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>
      </Show>

      <div class="bl__main">
        <TracksSidebar
          tracks={tracks} selectedTrack={selectedTrack} showAddMenu={showAddMenu}
          onSelectTrack={setSelectedTrack}
          onPatchTrack={trk.patchTrack}
          onDeleteTrack={trk.deleteTrack}
          onAddTrack={trk.addTrack}
          onSetShowAddMenu={setShowAddMenu}
          onShowNewTrack={() => setShowNewTrack(true)}
        />
        <TimelineArea
          tracks={tracks} selectedTrack={selectedTrack}
          pattern={pattern} playheadPx={playheadPx} setPlayheadPx={setPlayheadPx}
          drumClipBars={drumClipBars}
          dropTarget={trk.dropTarget} globalDragOver={trk.globalDragOver}
          onLaneDragOver={trk.onLaneDragOver} onLaneDragLeave={trk.onLaneDragLeave} onLaneDrop={trk.onLaneDrop}
          onLanesDragOver={trk.onLanesDragOver} onLanesDragLeave={trk.onLanesDragLeave} onLanesDrop={trk.onLanesDrop}
          onDeleteClip={trk.deleteClip}
          onMoveClip={trk.moveClip}
          onRenameClip={trk.renameClip}
          onDuplicateClip={trk.duplicateClip}
          onCreateRegion={trk.createRegion}
          onApplyTemplate={applyTemplate}
          onImportFiles={trk.importFiles}
          onAddTrack={trk.addTrack} onShowNewTrack={() => setShowNewTrack(true)}
        />
      </div>

      <Show when={activePanel() === "drum" && tracks().some(t => t.type === "drum")}>
        <DrumPanel
          pattern={pattern} currentStep={currentStep}
          drumSteps={drumSteps} drumSwing={drumSwing}
          drumVolume={() => tracks().find(t => t.type === "drum")?.volume ?? 0.8}
          onToggleStep={drum.toggleStep}
          onCycleStepVelocity={drum.cycleStepVelocity}
          onToggleRowMute={drum.toggleRowMute}
          onUpdateRowGain={drum.updateRowGain}
          onUpdateSwing={drum.updateSwing}
          onUpdateDrumSteps={drum.updateDrumSteps}
          onSetDrumVolume={(v) => {
            const drumTrack = tracks().find(t => t.type === "drum");
            if (drumTrack) trk.patchTrack(drumTrack.id, { volume: v });
          }}
          onClearPattern={drum.clearPattern}
          onCollapse={() => setActivePanel(null)}
        />
      </Show>

      <Show when={activePanel() === "keys" && (() => {
        const t = tracks().find(tr => tr.id === selectedTrack());
        return t && (t.type === "instrument" || t.type === "bass" || t.type === "guitar");
      })()}>
        <KeyboardPanel
          tracks={tracks} selectedTrack={selectedTrack}
          synthPreset={synthPreset} octave={octave} activeNotes={activeNotes}
          synthAttack={synthAttack} synthDecay={synthDecay}
          synthSustain={synthSustain} synthRelease={synthRelease}
          synthFilterFreq={synthFilterFreq} adsrPath={adsrPath}
          onPressKey={sth.pressKey} onReleaseKey={sth.releaseKey}
          onUpdatePreset={sth.updatePreset} onUpdateEnvelope={sth.updateEnvelope}
          onUpdateFilter={sth.updateFilterFreq}
          onSetOctave={setOctave}
          onSetVolume={(v) => {
            const id = selectedTrack();
            if (id) trk.patchTrack(id, { volume: v });
          }}
          onCollapse={() => setActivePanel(null)}
        />
      </Show>

      <BottomBar
        tracks={tracks} selectedTrack={selectedTrack}
        activePanel={activePanel} onSetActivePanel={setActivePanel}
        onLyricsToggle={() => setLyricsOpen(v => !v)}
        onSelectTrack={setSelectedTrack}
      />

      <Show when={navOpen()}>
        <NavDrawer
          navCat={navCat} setNavCat={setNavCat}
          cats={buildNavCats()} name={name}
          onClose={() => setNavOpen(false)}
          onExit={() => { setNavOpen(false); void saveAndNavigate("/dashboard"); }}
        />
      </Show>

      <Show when={lyricsOpen()}>
        <LyricsPanel text={lyricsText} onSetText={setLyricsText} onClose={() => setLyricsOpen(false)} projectName={name} projectId={params.id} />
      </Show>

      <Show when={showRestoreDialog()}>
        <RestoreDialog onRestore={project.restoreSession} onDiscard={project.discardSession} />
      </Show>

      <Show when={showNewTrack()}>
        <NewTrackModal onAddTrack={trk.addTrack} onClose={() => setShowNewTrack(false)} />
      </Show>


    </div>
  );
};

export default Studio;
