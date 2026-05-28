// `useTracks` manages the structural composition of the DAW timeline.
// It's responsible for dragging and dropping audio files, creating loops,
// snapping movements to the grid (bars/beats), moving clips across lanes,
// and resolving clip types (audio vs midi vs video).
// This hook directly manipulates the `tracks` array and instantly saves
// up to `persist.ts` whenever the timeline layout is modified.
import { createSignal } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { storeClip, removeClip } from "~/lib/clipStore";
import { deleteRemoteClip, uploadRemoteClip } from "~/lib/remoteClips";
import { type TrackType, type ClipKind, type MediaClip, type UITrack, type StudioTemplate, TRACK_DEFS, randomTrackColor } from "../types";
import type { PolySynth, SynthPreset } from "~/lib/audio/synth";
import type { StepSequencer } from "~/lib/audio/stepSeq";

const volToDb = (v: number) => v <= 0.001 ? -60 : 20 * Math.log10(v);

const BAR_PX = 80;
// Files larger than this won't have a dataUrl in the saved project JSON,
// so they must be uploaded to the server for cross-session / cross-device playback.
const REMOTE_UPLOAD_THRESHOLD_BYTES = 2_000_000; // Must match useProject's inline clip cap.

type Deps = {
  projectId: Accessor<string>;
  tracks: Accessor<UITrack[]>; setTracks: Setter<UITrack[]>;
  selectedTrack: Accessor<string | null>; setSelectedTrack: Setter<string | null>;
  bpm: Accessor<number>;
  setError: Setter<string>;
  setShowNewTrack: Setter<boolean>;
  ensureSynth: (preset: SynthPreset) => void;
  setSynthPreset: Setter<SynthPreset>;
  setActivePanel: Setter<"drum" | "keys" | null>;
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
  let warnedRemoteStorageUnavailable = false;

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
    if (file.size <= REMOTE_UPLOAD_THRESHOLD_BYTES) return undefined;
    const projectId = deps.projectId();
    if (!projectId) return undefined;

    try {
      const result = await uploadRemoteClip(projectId, clipId, file, file.type || "audio/mpeg");
      if (result.remoteUrl) return result.remoteUrl;
      console.warn(`[useTracks] server clip upload not stored (${result.status}) for ${clipId}`);
      if (!warnedRemoteStorageUnavailable) {
        warnedRemoteStorageUnavailable = true;
        deps.setError("Large audio is saved locally only until Netlify Blobs is available.");
        setTimeout(() => deps.setError(""), 3600);
      }
    } catch (err) {
      console.warn("[useTracks] server clip upload error:", err);
    }
    return undefined;
  };

  const addClip = async (trackId: string, file: File, barStart: number) => {
    const kind = classifyFile(file);
    if (!kind) {
      deps.setError("Unsupported file — drop audio, MIDI, or video");
      setTimeout(() => deps.setError(""), 2200);
      return;
    }
    const bars = await estimateBars(file, kind);
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
    const clip: MediaClip = { id: clipId, kind, name: file.name.replace(/\.[^.]+$/, ""), barStart: Math.max(0, barStart), bars, url };
    deps.setTracks(deps.tracks().map(t => t.id === trackId ? { ...t, clips: [...(t.clips ?? []), clip] } : t));

    if (kind !== "midi" && file.size > REMOTE_UPLOAD_THRESHOLD_BYTES) {
      const remoteUrl = await uploadLargeClip(clipId, file);
      if (remoteUrl) {
        deps.setTracks(deps.tracks().map(t => ({
          ...t,
          clips: (t.clips ?? []).map(c =>
            c.id === clipId ? { ...c, remoteUrl } : c
          ),
        })));
      }
    }
    await deps.save().catch((err) => console.warn("[useTracks] save after clip add failed:", err));
  };

  const deleteClip = (trackId: string, clipId: string) => {
    deps.setTracks(deps.tracks().map(t => {
      if (t.id !== trackId) return t;
      const target = (t.clips ?? []).find(c => c.id === clipId);
      if (target?.url) URL.revokeObjectURL(target.url);
      removeClip(clipId).catch(() => {});
      // Clean up server-side blob if it was uploaded
      const pid = deps.projectId();
      if (pid && target?.remoteUrl) {
        void deleteRemoteClip(pid, clipId).catch(() => {});
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
    if (openModal) deps.setShowNewTrack(false);
    void deps.save();
  };

  const deleteTrack = (id: string) => {
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
    addTrack, deleteTrack, patchTrack, addClip, deleteClip, importFiles,
    onLaneDragOver, onLaneDragLeave, onLaneDrop,
    onLanesDragOver, onLanesDragLeave, onLanesDrop,

    moveClip(trackId: string, clipId: string, newBarStart: number) {
      deps.setTracks(deps.tracks().map(t =>
        t.id !== trackId ? t : {
          ...t,
          clips: (t.clips ?? []).map(c =>
            c.id === clipId ? { ...c, barStart: Math.max(0, newBarStart) } : c
          ),
        }
      ));
      void deps.save();
    },

    createRegion(trackId: string, barStart: number) {
      const clip: MediaClip = {
        id: crypto.randomUUID(), kind: "midi", name: "Region",
        barStart: Math.max(0, barStart), bars: 4,
      };
      deps.setTracks(deps.tracks().map(t =>
        t.id === trackId ? { ...t, clips: [...(t.clips ?? []), clip] } : t
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
      const newClip: MediaClip = { ...clip, id: crypto.randomUUID(), barStart: clip.barStart + clip.bars, url: undefined };
      deps.setTracks(deps.tracks().map(t =>
        t.id !== trackId ? t : { ...t, clips: [...(t.clips ?? []), newClip] }
      ));
      void deps.save();
    },
  };
}
