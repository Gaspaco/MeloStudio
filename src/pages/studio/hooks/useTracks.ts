// `useTracks` manages the structural composition of the DAW timeline.
// It's responsible for dragging and dropping audio files, creating loops,
// snapping movements to the grid (bars/beats), moving clips across lanes,
// and resolving clip types (audio vs midi vs video).
// This hook directly manipulates the `tracks` array and instantly saves
// up to `persist.ts` whenever the timeline layout is modified.
import { createSignal } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { storeClip, removeClip } from "~/lib/clipStore";
import { deleteRemoteClip, remoteClipUploadErrorMessage, uploadRemoteClip } from "~/lib/remoteClips";
import {
  type TrackType,
  type ClipKind,
  type MediaClip,
  type MidiNoteEvent,
  type UITrack,
  type StudioTemplate,
  TRACK_DEFS,
  isAudioTrackType,
  isInstrumentTrackType,
  isTrackTypeAllowedForClipKind,
  randomTrackColor,
} from "../types";
import type { PolySynth, SynthPreset } from "~/lib/audio/synth";
import type { StepSequencer } from "~/lib/audio/stepSeq";
import { getAudioContext } from "~/lib/audio/context";
import {
  STUDIO_BAR_PX,
  STUDIO_BEAT_PX,
  clipLeftPx,
  clipWidthPx,
  moveRegionToPx,
  placeClip,
  resolveRegionOverwrite,
  splitRegionAtPx,
  trimRegionEdge,
  type RegionEdge,
} from "../lib/regionMath";

// Per-track mic state — NOT routed to output to prevent feedback
export interface MicEntry {
  stream: MediaStream;
  analyser: AnalyserNode;
}
const micEntries = new Map<string, MicEntry>();

export function getMicEntry(trackId: string): MicEntry | undefined {
  return micEntries.get(trackId);
}

async function connectMicToTrack(trackId: string, onError: (msg: string) => void): Promise<void> {
  disconnectMicFromTrack(trackId);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ctx = getAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    // Analyser only — never connect to destination to avoid feedback loop
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    micEntries.set(trackId, { stream, analyser });
  } catch {
    onError("Microphone access denied — check browser permissions");
  }
}

function disconnectMicFromTrack(trackId: string): void {
  const entry = micEntries.get(trackId);
  if (!entry) return;
  entry.stream.getTracks().forEach(t => t.stop());
  micEntries.delete(trackId);
}

const volToDb = (v: number) => v <= 0.001 ? -60 : 20 * Math.log10(v);

const BAR_PX = STUDIO_BAR_PX;
// Files larger than this won't have a dataUrl in the saved project JSON,
// so they must be uploaded to the server for cross-session / cross-device playback.
const REMOTE_UPLOAD_THRESHOLD_BYTES = 2_000_000; // Must match useProject's inline clip cap.
const createRegionId = () => crypto.randomUUID();

type Deps = {
  projectId: Accessor<string>;
  tracks: Accessor<UITrack[]>; setTracks: Setter<UITrack[]>;
  selectedTrack: Accessor<string | null>; setSelectedTrack: Setter<string | null>;
  bpm: Accessor<number>;
  playheadPx: Accessor<number>;
  setError: Setter<string>;
  setShowNewTrack: Setter<boolean>;
  ensureSynth: (preset: SynthPreset) => void;
  setSynthPreset: Setter<SynthPreset>;
  setActivePanel: Setter<"drum" | "keys" | "voice" | null>;
  setDrumPanelOpen: Setter<boolean>;
  getSeq: () => StepSequencer | null;
  getSynth: () => PolySynth | null;
  setTrackVolume: (id: string, v: number) => void;
  save: () => Promise<void>;
  timelineEl: () => HTMLDivElement | undefined;
};

export function useTracks(deps: Deps) {
  const [dropTarget, setDropTarget] = createSignal<{ trackId: string; bar: number } | null>(null);
  const [globalDragOver, setGlobalDragOver] = createSignal(false);
  const [recordingTrackId, setRecordingTrackId] = createSignal<string | null>(null);
  const [recordingStartPx, setRecordingStartPx] = createSignal(0);
  const [recordingStartTime, setRecordingStartTime] = createSignal(0);
  const [recordingMode, setRecordingMode] = createSignal<"audio" | "midi" | null>(null);
  let mediaRecorder: MediaRecorder | null = null;
  let recordChunks: BlobPart[] = [];
  let recEndPx = 0;
  let warnedRemoteStorageUnavailable = false;
  let midiRecordTrackId: string | null = null;
  let midiRecordedNotes: MidiNoteEvent[] = [];
  const activeMidiNotes = new Map<number, { startPx: number; velocity: number }>();

  const trackById = (trackId: string) => deps.tracks().find(t => t.id === trackId);

  const clipKindLabel = (kind: ClipKind) => kind === "midi" ? "MIDI" : "audio";

  const rejectIncompatibleClip = (track: UITrack | undefined, kind: ClipKind) => {
    const trackName = track?.name ?? "this track";
    deps.setError(`${clipKindLabel(kind)} regions cannot be placed on ${trackName}. Use ${kind === "midi" ? "an instrument" : "an audio"} track.`);
    setTimeout(() => deps.setError(""), 2800);
  };

  const startRecording = (trackId: string) => {
    const track = trackById(trackId);
    if (!track || !isAudioTrackType(track.type)) {
      deps.setError("Recording is only available on Voice / Audio tracks.");
      setTimeout(() => deps.setError(""), 2600);
      return;
    }
    const entry = getMicEntry(trackId);
    // Stream tracks can end after MediaRecorder.stop() in Chrome — reconnect silently
    if (!entry || entry.stream.getTracks().some(t => t.readyState === "ended")) {
      void connectMicToTrack(trackId, deps.setError).then(() => startRecording(trackId));
      return;
    }
    if (mediaRecorder) stopRecording();
    stopMidiRecording();
    recordChunks = [];
    const startPx = deps.playheadPx();
    const recStartTime = performance.now();
    const mr = new MediaRecorder(entry.stream);
    mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunks.push(e.data); };
    mr.onstop = async () => {
      const widthPx = Math.max(1, recEndPx - startPx);
      const bars = widthPx / BAR_PX;
      const blob = new Blob(recordChunks, { type: mr.mimeType });
      const ext = mr.mimeType.includes("ogg") ? "ogg" : mr.mimeType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `Take ${Date.now()}.${ext}`, { type: mr.mimeType });
      setRecordingTrackId(null);
      setRecordingMode(null);
      void connectMicToTrack(trackId, deps.setError);
      await addClip(trackId, file, startPx / BAR_PX, bars, { leftPx: startPx, widthPx });
    };
    mr.start(100);
    mediaRecorder = mr;
    setRecordingStartPx(startPx);
    setRecordingStartTime(recStartTime);
    setRecordingTrackId(trackId);
    setRecordingMode("audio");
  };

  const stopRecording = () => {
    if (mediaRecorder?.state === "recording") {
      recEndPx = deps.playheadPx();
      mediaRecorder.stop();
    }
    mediaRecorder = null;
  };

  const startMidiRecording = (trackId: string) => {
    const track = trackById(trackId);
    if (!track || !isInstrumentTrackType(track.type)) {
      deps.setError("MIDI recording is only available on instrument tracks.");
      setTimeout(() => deps.setError(""), 2600);
      return;
    }
    if (mediaRecorder) stopRecording();
    if (midiRecordTrackId) stopMidiRecording();
    midiRecordTrackId = trackId;
    midiRecordedNotes = [];
    activeMidiNotes.clear();
    setRecordingTrackId(trackId);
    setRecordingStartPx(Math.max(0, deps.playheadPx()));
    setRecordingStartTime(performance.now());
    setRecordingMode("midi");
  };

  const captureMidiNoteOn = (midi: number, velocity = 0.85) => {
    if (!midiRecordTrackId || activeMidiNotes.has(midi)) return;
    activeMidiNotes.set(midi, {
      startPx: Math.max(0, deps.playheadPx()),
      velocity: Math.max(0, Math.min(1, velocity)),
    });
  };

  const captureMidiNoteOff = (midi: number) => {
    if (!midiRecordTrackId) return;
    const active = activeMidiNotes.get(midi);
    if (!active) return;
    activeMidiNotes.delete(midi);
    const endPx = Math.max(active.startPx + STUDIO_BEAT_PX / 8, deps.playheadPx());
    midiRecordedNotes.push({
      midi,
      startBars: active.startPx / BAR_PX,
      durationBars: (endPx - active.startPx) / BAR_PX,
      velocity: active.velocity,
    });
  };

  const stopMidiRecording = () => {
    if (!midiRecordTrackId) return;
    for (const midi of [...activeMidiNotes.keys()]) captureMidiNoteOff(midi);
    const trackId = midiRecordTrackId;
    const notes = midiRecordedNotes.filter(note => note.durationBars > 0);
    midiRecordTrackId = null;
    midiRecordedNotes = [];
    activeMidiNotes.clear();
    setRecordingTrackId(null);
    setRecordingMode(null);
    if (!notes.length) return;

    const startBar = Math.min(...notes.map(note => note.startBars));
    const endBar = Math.max(...notes.map(note => note.startBars + note.durationBars));
    const clipStartPx = startBar * BAR_PX;
    const clipWidthPx = Math.max(STUDIO_BEAT_PX / 4, (endBar - startBar) * BAR_PX);
    const clip = placeClip({
      id: crypto.randomUUID(),
      kind: "midi",
      name: `MIDI Take ${Date.now()}`,
      barStart: startBar,
      bars: clipWidthPx / BAR_PX,
      midiNotes: notes.map(note => ({ ...note, startBars: note.startBars - startBar })),
    }, clipStartPx, clipWidthPx);

    deps.setTracks(deps.tracks().map(t =>
      t.id === trackId ? {
        ...t,
        clips: resolveRegionOverwrite([...(t.clips ?? []), clip], clip, createRegionId),
      } : t
    ));
    void deps.save();
  };

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
          const bars = Math.max(1, Math.round((secs * deps.bpm() / 60) / 4));
          done(bars);
        };
        el.onerror = () => done(4);
      } catch { resolve(4); }
    });
  };

  const uploadLargeClip = async (clipId: string, file: File): Promise<string | undefined> => {
    const projectId = deps.projectId();
    if (!projectId) return undefined;

    try {
      const result = await uploadRemoteClip(projectId, clipId, file, file.type || "audio/mpeg");
      if (result.remoteUrl) return result.remoteUrl;
      console.warn(`[useTracks] server clip upload not stored (${result.status}) for ${clipId}`);
      if (!warnedRemoteStorageUnavailable) {
        warnedRemoteStorageUnavailable = true;
        deps.setError(remoteClipUploadErrorMessage(result));
        setTimeout(() => deps.setError(""), 3600);
      }
    } catch (err) {
      console.warn("[useTracks] server clip upload error:", err);
      if (!warnedRemoteStorageUnavailable) {
        warnedRemoteStorageUnavailable = true;
        deps.setError("Large audio upload failed. It will only play from this browser for now.");
        setTimeout(() => deps.setError(""), 3600);
      }
    }
    return undefined;
  };

  const addClip = async (trackId: string, file: File, barStart: number, barsOverride?: number, pixelOverride?: { leftPx: number; widthPx: number }) => {
    const kind = classifyFile(file);
    if (!kind) {
      deps.setError("Unsupported file — drop audio, MIDI, or video");
      setTimeout(() => deps.setError(""), 2200);
      return;
    }
    const targetTrack = trackById(trackId);
    if (!targetTrack || !isTrackTypeAllowedForClipKind(targetTrack.type, kind)) {
      rejectIncompatibleClip(targetTrack, kind);
      return;
    }
    const bars = barsOverride ?? await estimateBars(file, kind);
    const clipId = crypto.randomUUID();
    let url: string | undefined;
    if (kind !== "midi") {
      url = URL.createObjectURL(file);
      // Store in IndexedDB for local session persistence
      const stored = await storeClip(clipId, file).then(() => true).catch(() => false);
      if (!stored) {
        console.warn(`[useTracks] IDB storeClip failed for clip ${clipId} (${file.name}, ${file.size} bytes)`);
      }
    }
    const clip: MediaClip = placeClip({
      id: clipId, assetId: clipId, kind, name: file.name.replace(/\.[^.]+$/, ""),
      barStart: Math.max(0, barStart), bars, url,
      ...(pixelOverride ?? {}),
    }, pixelOverride?.leftPx ?? barStart * BAR_PX, pixelOverride?.widthPx ?? bars * BAR_PX);
    deps.setTracks(deps.tracks().map(t =>
      t.id === trackId
        ? { ...t, clips: resolveRegionOverwrite([...(t.clips ?? []), clip], clip, createRegionId) }
        : t
    ));

    // Upload to server for any audio clip — ensures persistence even if IDB is cleared
    if (kind !== "midi") {
      const remoteUrl = await uploadLargeClip(clipId, file);
      if (remoteUrl) {
        deps.setTracks(deps.tracks().map(t => {
          if (!t.clips?.some(c => c.id === clipId)) return t;
          return {
            ...t,
            clips: t.clips.map(c => c.id === clipId ? { ...c, remoteUrl } : c),
          };
        }));
      }
    }
    await deps.save().catch((err) => console.warn("[useTracks] save after clip add failed:", err));
  };

  const deleteClip = (trackId: string, clipId: string) => {
    deps.setTracks(deps.tracks().map(t => {
      if (t.id !== trackId) return t;
      const target = (t.clips ?? []).find(c => c.id === clipId);
      const targetAssetId = target?.assetId ?? target?.id;
      const otherClips = deps.tracks().flatMap(track => track.clips ?? []).filter(c => c.id !== clipId);
      const assetStillUsed = targetAssetId ? otherClips.some(c => (c.assetId ?? c.id) === targetAssetId) : false;
      const urlStillUsed = target?.url ? otherClips.some(c => c.url === target.url) : false;
      if (target?.url && !urlStillUsed) URL.revokeObjectURL(target.url);
      if (targetAssetId && !assetStillUsed) removeClip(targetAssetId).catch(() => {});
      removeClip(clipId).catch(() => {});
      const pid = deps.projectId();
      if (pid && target?.remoteUrl && targetAssetId && !assetStillUsed) {
        void deleteRemoteClip(pid, targetAssetId).catch(() => {});
      }
      return { ...t, clips: (t.clips ?? []).filter(c => c.id !== clipId) };
    }));
  };

  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    for (const f of files) {
      const kind = classifyFile(f);
      if (!kind) continue;
      const type = kind === "midi" ? "instrument" : "voice";
      const lastColor = deps.tracks().slice(-1)[0]?.color;
      const newTrack: UITrack = {
        id: crypto.randomUUID(), name: f.name.replace(/\.[^.]+$/, ""),
        type, muted: false, solo: false, volume: 0.8, pan: 0,
        color: randomTrackColor(lastColor), clips: [],
      };
      deps.setTracks(prev => [...prev, newTrack]);
      deps.setSelectedTrack(newTrack.id);
      await addClip(newTrack.id, f, 0);
    }
    void deps.save();
  };

  const addTrack = (type: TrackType, openModal = true) => {
    const def = TRACK_DEFS.find(d => d.type === type);
    if (!def) return;
    if (!def.ready) {
      deps.setError(`${def.label} coming soon — try Drum Machine`);
      setTimeout(() => deps.setError(""), 2200);
      return;
    }
    if (type === "drum" && deps.tracks().some(t => t.type === "drum")) {
      const drumTrack = deps.tracks().find(t => t.type === "drum");
      if (!drumTrack) return;
      deps.setSelectedTrack(drumTrack.id);
      deps.setDrumPanelOpen(true);
      if (openModal) deps.setShowNewTrack(false);
      return;
    }
    if (type === "instrument" || type === "bass" || type === "guitar") {
      const initPreset: SynthPreset = type === "bass" ? "bass" : type === "guitar" ? "guitar" : "piano";
      deps.ensureSynth(initPreset);
      if (type === "bass") deps.setSynthPreset("bass");
      else if (type === "guitar") deps.setSynthPreset("guitar");
    }
    const t: UITrack = {
      id: crypto.randomUUID(), name: def.label, type,
      muted: false, solo: false, volume: 0.8, pan: 0,
      color: type === "drum" ? def.color : randomTrackColor(),
    };
    deps.setTracks([...deps.tracks(), t]);
    deps.setSelectedTrack(t.id);
    if (type === "drum") { deps.setDrumPanelOpen(true); deps.setActivePanel("drum"); }
    else if (type === "instrument" || type === "bass" || type === "guitar") deps.setActivePanel("keys");
    else if (type === "voice") void connectMicToTrack(t.id, deps.setError);
    if (openModal) deps.setShowNewTrack(false);
    void deps.save();
  };

  const deleteTrack = (id: string) => {
    disconnectMicFromTrack(id);
    deps.setTracks(deps.tracks().filter(t => t.id !== id));
    if (deps.selectedTrack() === id) deps.setSelectedTrack(null);
    void deps.save();
  };

  const patchTrack = (id: string, patch: Partial<UITrack>) => {
    deps.setTracks(deps.tracks().map(t => t.id === id ? { ...t, ...patch } : t));
    if (patch.volume !== undefined) {
      const track = deps.tracks().find(t => t.id === id);
      if (!track) return;
      const db = volToDb(patch.volume);
      if (track.type === "instrument" || track.type === "bass" || track.type === "guitar") {
        deps.getSynth()?.setMasterGainDb(db);
      } else if (track.type === "drum") {
        deps.getSeq()?.setMasterGainDb(db);
      } else {
        // voice / sampler / audio clip tracks — update the per-track gain node
        deps.setTrackVolume(id, patch.volume);
      }
    }
  };

  const onLaneDragOver = (e: DragEvent, trackId: string) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    const track = trackById(trackId);
    if (files.length > 0 && track && files.some(file => {
      const kind = classifyFile(file);
      return !kind || !isTrackTypeAllowedForClipKind(track.type, kind);
    })) {
      e.dataTransfer.dropEffect = "none";
      setDropTarget(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scrollLeft = deps.timelineEl()?.scrollLeft ?? 0;
    const x = e.clientX - rect.left + scrollLeft;
    setDropTarget({ trackId, bar: Math.max(0, Math.floor(x / BAR_PX)) });
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
    const track = trackById(trackId);
    if (!track) return;
    const incompatible = files.find(file => {
      const kind = classifyFile(file);
      return !kind || !isTrackTypeAllowedForClipKind(track.type, kind);
    });
    if (incompatible) {
      const kind = classifyFile(incompatible);
      if (kind) rejectIncompatibleClip(track, kind);
      else {
        deps.setError("Unsupported file. Drop audio on audio tracks or MIDI on instrument tracks.");
        setTimeout(() => deps.setError(""), 2800);
      }
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scrollLeft = deps.timelineEl()?.scrollLeft ?? 0;
    const x = e.clientX - rect.left + scrollLeft;
    let cursor = Math.max(0, Math.floor(x / BAR_PX));
    for (const f of files) {
      await addClip(trackId, f, cursor);
      const last = deps.tracks().find(t => t.id === trackId)?.clips?.slice(-1)[0];
      cursor += last?.bars ?? 4;
    }
  };

  const onLanesDragOver = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
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
    if (dropTarget()) return;
    e.preventDefault();
    setGlobalDragOver(false);
    await importFiles(Array.from(e.dataTransfer?.files ?? []));
  };

  return {
    dropTarget, globalDragOver,
    recordingTrackId, recordingStartPx, recordingStartTime, recordingMode,
    startRecording, stopRecording, startMidiRecording, stopMidiRecording, captureMidiNoteOn, captureMidiNoteOff,
    addTrack, deleteTrack, patchTrack, addClip, deleteClip, importFiles,
    onLaneDragOver, onLaneDragLeave, onLaneDrop,
    onLanesDragOver, onLanesDragLeave, onLanesDrop,

    moveClip(trackId: string, clipId: string, newBarStart: number) {
      const snapped = Math.max(0, newBarStart);
      const movedLeftPx = snapped * BAR_PX;
      deps.setTracks(deps.tracks().map(t =>
        t.id !== trackId ? t : {
          ...t,
          clips: moveRegionToPx(t.clips ?? [], clipId, movedLeftPx, createRegionId),
        }
      ));
      void deps.save();
    },

    moveClipToTrack(sourceTrackId: string, clipId: string, targetTrackId: string, newBarStart: number) {
      const sourceTrack = deps.tracks().find(t => t.id === sourceTrackId);
      const targetTrack = deps.tracks().find(t => t.id === targetTrackId);
      const clip = sourceTrack?.clips?.find(c => c.id === clipId);
      if (!sourceTrack || !targetTrack || !clip) return;
      if (!isTrackTypeAllowedForClipKind(targetTrack.type, clip.kind)) {
        rejectIncompatibleClip(targetTrack, clip.kind);
        return;
      }

      if (sourceTrackId === targetTrackId) {
        const movedLeftPx = Math.max(0, newBarStart) * BAR_PX;
        deps.setTracks(deps.tracks().map(t =>
          t.id !== sourceTrackId ? t : {
            ...t,
            clips: moveRegionToPx(t.clips ?? [], clipId, movedLeftPx, createRegionId),
          }
        ));
        void deps.save();
        return;
      }

      const movedClip = placeClip(clip, Math.max(0, newBarStart) * BAR_PX, clipWidthPx(clip));
      deps.setTracks(deps.tracks().map(t => {
        if (t.id === sourceTrackId) {
          return { ...t, clips: (t.clips ?? []).filter(c => c.id !== clipId) };
        }
        if (t.id === targetTrackId) {
          return {
            ...t,
            clips: resolveRegionOverwrite([...(t.clips ?? []), movedClip], movedClip, createRegionId),
          };
        }
        return t;
      }));
      deps.setSelectedTrack(targetTrackId);
      void deps.save();
    },

    trimClip(trackId: string, clipId: string, edge: RegionEdge, targetPx: number) {
      deps.setTracks(deps.tracks().map(t =>
        t.id !== trackId ? t : {
          ...t,
          clips: trimRegionEdge(t.clips ?? [], clipId, edge, Math.max(0, targetPx), createRegionId),
        }
      ));
      void deps.save();
    },

    splitClipAtPlayhead(trackId: string, clipId: string, playheadPx: number) {
      deps.setTracks(deps.tracks().map(t =>
        t.id !== trackId ? t : {
          ...t,
          clips: splitRegionAtPx(t.clips ?? [], clipId, Math.max(0, playheadPx), createRegionId),
        }
      ));
      void deps.save();
    },

    createRegion(trackId: string, barStart: number) {
      const track = trackById(trackId);
      if (!track || !isInstrumentTrackType(track.type)) {
        deps.setError("MIDI regions can only be created on instrument tracks.");
        setTimeout(() => deps.setError(""), 2600);
        return;
      }
      const clip: MediaClip = {
        id: crypto.randomUUID(), kind: "midi", name: "Region",
        barStart: Math.max(0, barStart), bars: 4,
      };
      const placedClip = placeClip(clip, barStart * BAR_PX, 4 * BAR_PX);
      deps.setTracks(deps.tracks().map(t =>
        t.id === trackId ? {
          ...t,
          clips: resolveRegionOverwrite([...(t.clips ?? []), placedClip], placedClip, createRegionId),
        } : t
      ));
      void deps.save();
    },

    addTrackBatch(templateTracks: StudioTemplate["tracks"]) {
      const newTracks: UITrack[] = templateTracks.map(({ type, name }) => {
        const def = TRACK_DEFS.find(d => d.type === type)!;
        return {
          id: crypto.randomUUID(), name, type,
          muted: false, solo: false, volume: 0.8, pan: 0,
          color: type === "drum" ? def.color : randomTrackColor(),
        };
      });
      deps.setTracks(newTracks);
      deps.setSelectedTrack(newTracks[0]?.id ?? null);
      const hasDrum = newTracks.some(t => t.type === "drum");
      if (hasDrum) { deps.setDrumPanelOpen(true); deps.setActivePanel("drum"); }
      const keyTrack = newTracks.find(t =>
        t.type === "instrument" || t.type === "bass" || t.type === "guitar"
      );
      if (keyTrack) {
        const preset: SynthPreset =
          keyTrack.type === "bass" ? "bass" : keyTrack.type === "guitar" ? "guitar" : "piano";
        deps.ensureSynth(preset);
        deps.setSynthPreset(preset);
      }
      deps.setShowNewTrack(false);
      void deps.save();
    },

    renameClip(trackId: string, clipId: string, name: string) {
      deps.setTracks(deps.tracks().map(t =>
        t.id !== trackId ? t : {
          ...t,
          clips: (t.clips ?? []).map(c => c.id === clipId ? { ...c, name } : c),
        }
      ));
      void deps.save();
    },

    duplicateClip(trackId: string, clipId: string) {
      const track = deps.tracks().find(t => t.id === trackId);
      if (!track) return;
      const clip = (track.clips ?? []).find(c => c.id === clipId);
      if (!clip) return;
      // `url: undefined` — Blob URLs are single-use per page load; the scheduler re-fetches via remoteUrl or IDB for the duplicate
      const newLeftPx = clipLeftPx(clip) + clipWidthPx(clip);
      const newClip: MediaClip = {
        ...placeClip(clip, newLeftPx, clipWidthPx(clip)),
        id: crypto.randomUUID(),
      };
      deps.setTracks(deps.tracks().map(t =>
        t.id !== trackId ? t : {
          ...t,
          clips: resolveRegionOverwrite([...(t.clips ?? []), newClip], newClip, createRegionId),
        }
      ));
      void deps.save();
    },
  };
}
