// `useProject` handles the initial data load, parsing, and structured initialization
// of a Studio project when you hit the `/studio/[id]` route. It wraps API calls 
// securely, hydrates the UI state from the DB JSON doc, and resolves legacy tracks 
// into currently supported tracks. It's also fully async via `suspense` in SolidJS,
// putting up a clean loading state until the studio is absolutely ready to play.
import { createEffect, createSignal, onCleanup } from "solid-js";
import { apiFetch, getProjectDocApi, putProjectDocApi } from "~/lib/api";
import { unlockAudioContext } from "~/lib/audio/context";
import type { Accessor, Setter } from "solid-js";
import { sanitizePattern, DEFAULT_PATTERN, type StepPattern, type StepSequencer } from "~/lib/audio/stepSeq";
import { type SynthPreset } from "~/lib/audio/synth";
import { loadClip, loadClipBlob, removeClip, storeClip } from "~/lib/clipStore";
import { remoteClipUploadErrorMessage, uploadRemoteClip } from "~/lib/remoteClips";
import { type MediaClip, type UITrack, TRACK_DEFS, hasStudioContent } from "../types";

type Deps = {
  projectId: string;
  navigate: (path: string) => void;
  getSeq: () => StepSequencer | null;
  ensureSynth: (preset: SynthPreset) => void;
  name: Accessor<string>; setName: Setter<string>;
  tracks: Accessor<UITrack[]>; setTracks: Setter<UITrack[]>;
  selectedTrack: Accessor<string | null>; setSelectedTrack: Setter<string | null>;
  bpm: Accessor<number>; setBpm: Setter<number>;
  timeSig: Accessor<[number, number]>; setTimeSig: Setter<[number, number]>;
  musicalKey: Accessor<string>; setMusicalKey: Setter<string>;
  pattern: Accessor<StepPattern>; setPattern: Setter<StepPattern>;
  synthPreset: Accessor<SynthPreset>; setSynthPreset: Setter<SynthPreset>;
  setDrumPanelOpen: Setter<boolean>;
  setShowNewTrack: Setter<boolean>;
  saveState: Accessor<"idle" | "saving" | "saved">; setSaveState: Setter<"idle" | "saving" | "saved">;
  setError: Setter<string>;
  setShowRestoreDialog: Setter<boolean>;
  setPublished?: (v: boolean) => void;
  lyricsText?: Accessor<string>;
  setLyricsText?: Setter<string>;
};

export function useProject(deps: Deps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pendingDoc: any = null;
  let loadedProjectDoc: any = null; // holds the server doc so discard can fall back to it
  let pendingDocSource: "project" | "draft" | null = null;
  const [initialized, setInitialized] = createSignal(false);
  let applyingDoc = false;
  let baselineJson = "";
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  let warnedRemoteStorageUnavailable = false;
  const DRAFT_VERSION = 1;
  const DRAFT_DEBOUNCE_MS = 600;
  const AUTOSAVE_DEBOUNCE_MS = 5_000;
  const draftKey = `melostudio:studio-draft:${deps.projectId}`;
  const MAX_SAVE_PAYLOAD_BYTES = 4_500_000;

  type StudioDraft = {
    version: typeof DRAFT_VERSION;
    projectId: string;
    updatedAt: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any;
  };

  const clipBlob = async (clip: MediaClip): Promise<Blob | null> => {
    let blob = await loadClipBlob(clip.id).catch(() => null);
    if (!blob && clip.url) blob = await fetch(clip.url).then((res) => res.blob()).catch(() => null);
    return blob;
  };

  const optionalRemoteClipUrl = (remoteUrl: string) =>
    `${remoteUrl}${remoteUrl.includes("?") ? "&" : "?"}optional=1`;

  const remoteClipExists = async (remoteUrl: string): Promise<boolean | null> => {
    const res = await apiFetch(optionalRemoteClipUrl(remoteUrl), { method: "HEAD" }).catch(() => null);
    if (!res) return null;
    if (res.status === 204) return false;
    if (res.ok) return true;
    return null;
  };

  const tryRemoteUpload = async (clip: MediaClip, blob: Blob): Promise<string | undefined> => {
    try {
      const result = await uploadRemoteClip(deps.projectId, clip.id, blob, blob.type || "audio/mpeg");
      if (result.remoteUrl) return result.remoteUrl;
      console.warn(`[useProject] server clip upload not stored (${result.status}) for ${clip.id}`);
      if (!warnedRemoteStorageUnavailable) {
        warnedRemoteStorageUnavailable = true;
        deps.setError(remoteClipUploadErrorMessage(result));
        setTimeout(() => deps.setError(""), 3600);
      }
    } catch (err) {
      console.warn("[useProject] server clip upload error:", err);
      if (!warnedRemoteStorageUnavailable) {
        warnedRemoteStorageUnavailable = true;
        deps.setError("Audio upload failed. It will only play from this browser for now.");
        setTimeout(() => deps.setError(""), 3600);
      }
    }
    return undefined;
  };

  const persistedClipFields = async (clip: MediaClip): Promise<Pick<MediaClip, "dataUrl" | "remoteUrl">> => {
    if (clip.kind === "midi") return { dataUrl: undefined, remoteUrl: undefined };

    const blob = await clipBlob(clip);
    let remoteUrl = clip.remoteUrl;

    if (!remoteUrl && blob) {
      remoteUrl = await tryRemoteUpload(clip, blob);
    } else if (remoteUrl) {
      const exists = await remoteClipExists(remoteUrl);
      if (exists === false) {
        remoteUrl = blob ? await tryRemoteUpload(clip, blob) : undefined;
      }
    }

    return { dataUrl: undefined, remoteUrl };
  };

  const cleanTracksForDraft = (tracks: UITrack[]): UITrack[] => tracks.map((track) => ({
    ...track,
    clips: track.clips?.map((clip) => ({ ...clip, url: undefined })),
  }));

  const currentDraftDoc = () => {
    const seq = deps.getSeq();
    const pattern = deps.pattern();
    return {
      id: deps.projectId,
      name: deps.name(),
      transport: { bpm: deps.bpm(), timeSig: deps.timeSig() },
      musicalKey: deps.musicalKey(),
      beat: { pattern: seq?.getPattern() ?? pattern },
      uiTracks: cleanTracksForDraft(deps.tracks()),
      lyrics: deps.lyricsText?.() ?? "",
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedProjectJson = (doc: any) => JSON.stringify({
    name: doc.name ?? "Untitled",
    transport: {
      bpm: doc.transport?.bpm ?? 120,
      timeSig: doc.transport?.timeSig ?? [4, 4],
    },
    musicalKey: doc.musicalKey ?? "Auto",
    beat: { pattern: sanitizePattern(doc.beat?.pattern ?? DEFAULT_PATTERN()) },
    uiTracks: cleanTracksForDraft((doc.uiTracks ?? []) as UITrack[]),
    lyrics: doc.lyrics ?? "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasRecoverableContent = (doc: any) => {
    const tracks = (doc.uiTracks ?? []) as UITrack[];
    return hasStudioContent(tracks, doc.beat?.pattern, doc.lyrics);
  };

  const clearNewProjectParam = () => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("new") === "1") {
      sp.delete("new");
      window.history.replaceState({}, "", window.location.pathname + (sp.toString() ? `?${sp.toString()}` : ""));
    }
  };

  const readLocalDraft = (): StudioDraft | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return null;
      const draft = JSON.parse(raw) as StudioDraft;
      if (draft.version !== DRAFT_VERSION || draft.projectId !== deps.projectId || !draft.doc) return null;
      return draft;
    } catch {
      return null;
    }
  };

  const writeLocalDraft = (doc: ReturnType<typeof currentDraftDoc>) => {
    if (typeof window === "undefined") return;
    const draft: StudioDraft = {
      version: DRAFT_VERSION,
      projectId: deps.projectId,
      updatedAt: Date.now(),
      doc,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch (err) {
      console.warn("[useProject] local draft save failed:", err);
    }
  };

  const removeLocalDraft = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch { /* ignore */ }
  };

  const writeDraftIfChanged = () => {
    if (!initialized() || applyingDoc || pendingDoc) return;
    const doc = currentDraftDoc();
    const draftJson = normalizedProjectJson(doc);
    if (draftJson === baselineJson) {
      removeLocalDraft();
      return;
    }
    writeLocalDraft(doc);
  };

  const fitProjectSavePayload = <T extends { uiTracks?: UITrack[] }>(doc: T): { payload: T; json: string } => {
    const json = JSON.stringify(doc);
    return { payload: doc, json };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyDoc = async (doc: any) => {
    applyingDoc = true;
    try {
      deps.setName(doc.name ?? "Untitled");
      if (doc.lyrics != null) deps.setLyricsText?.(doc.lyrics as string);
      if (doc.transport?.bpm) deps.setBpm(doc.transport.bpm);
      if (doc.transport?.timeSig) deps.setTimeSig(doc.transport.timeSig as [number, number]);
      if (doc.musicalKey) deps.setMusicalKey(doc.musicalKey);

      const pat: StepPattern | undefined = doc.beat?.pattern;
      if (pat?.rows?.length) {
        const cleanPat = sanitizePattern(pat);
        deps.setPattern(cleanPat);
        deps.getSeq()?.setPattern(cleanPat);
        if (cleanPat.bpm) deps.setBpm(cleanPat.bpm);
      }

      const savedTracks = ((doc.uiTracks ?? []) as UITrack[]);
      if (savedTracks.length && hasStudioContent(savedTracks, doc.beat?.pattern, doc.lyrics)) {
        const restoredTracks: UITrack[] = [];
        let missingClipCount = 0;
        for (const t of savedTracks) {
          if (!TRACK_DEFS.find(d => d.type === t.type)) continue;
          const restoredClips = [];
          for (const clip of t.clips ?? []) {
            if (clip.kind !== "midi") {
              let remoteUrl = clip.remoteUrl;
              // 1. Try IndexedDB (fast, local)
              let url = await loadClip(clip.id).catch(() => null);
              // 2. Fall back to inline dataUrl (small clips only)
              if (!url && clip.dataUrl) {
                const blob = await fetch(clip.dataUrl).then((res) => res.blob()).catch(() => null);
                if (blob) {
                  await storeClip(clip.id, blob).catch(() => {});
                  url = URL.createObjectURL(blob);
                }
              }
              // 3. Fall back to server-side storage (large clips, cross-device)
              if (!url && remoteUrl) {
                let res = await apiFetch(optionalRemoteClipUrl(remoteUrl)).catch(() => null);
                if (!res) res = await apiFetch(optionalRemoteClipUrl(remoteUrl)).catch(() => null);
                if (res && res.status === 204) {
                  remoteUrl = undefined;
                } else if (res && res.ok) {
                  const blob = await res.blob().catch(() => null);
                  if (blob && blob.size > 0) {
                    await storeClip(clip.id, blob).catch(() => {});
                    url = URL.createObjectURL(blob);
                  }
                }
              }
              if (!url && !remoteUrl) {
                missingClipCount++;
                continue;
              }
              restoredClips.push({ ...clip, remoteUrl, url: url ?? undefined });
            } else {
              restoredClips.push(clip);
            }
          }
          restoredTracks.push({ ...t, clips: restoredClips });
          if (t.type === "bass") deps.setSynthPreset("bass");
          else if (t.type === "guitar") deps.setSynthPreset("guitar");
        }
        deps.setTracks(restoredTracks);
        deps.setSelectedTrack(restoredTracks[0]?.id ?? null);
        const hasDrum = restoredTracks.some(t => t.type === "drum");
        const seq = deps.getSeq();
        if (hasDrum && pat?.rows?.length && seq) seq.setPattern(sanitizePattern(pat));
        if (hasDrum) deps.setDrumPanelOpen(true);
        if (missingClipCount > 0) {
          deps.setError(`${missingClipCount} audio clip${missingClipCount === 1 ? " is" : "s are"} missing. Re-import the original file to restore it.`);
          setTimeout(() => deps.setError(""), 6000);
        }
      } else {
        deps.setTracks([]);
        deps.setSelectedTrack(null);
      }
    } finally {
      applyingDoc = false;
    }
  };

  const restoreSession = async () => {
    deps.setShowRestoreDialog(false);
    // Unlock AudioContext within the user-gesture callback so Peaks.js can
    // call decodeAudioData without hitting the browser's autoplay block.
    await unlockAudioContext().catch(() => {});
    if (pendingDoc) await applyDoc(pendingDoc);
    pendingDoc = null;
    pendingDocSource = null;
    setInitialized(true);
  };

  const discardSession = async () => {
    deps.setShowRestoreDialog(false);
    if (!pendingDoc) {
      pendingDocSource = null;
      return;
    }

    if (pendingDocSource === "draft") {
      pendingDoc = null;
      pendingDocSource = null;
      removeLocalDraft();
      if (loadedProjectDoc) await applyDoc(loadedProjectDoc);
      setInitialized(true);
      return;
    }

    for (const t of (pendingDoc.uiTracks ?? []) as UITrack[]) {
      for (const clip of t.clips ?? []) removeClip(clip.id).catch(() => {});
    }
    pendingDoc = null;
    pendingDocSource = null;
    removeLocalDraft();
    const docResult = await getProjectDocApi(deps.projectId);
    if (!docResult) {
      setInitialized(true);
      return;
    }
    const doc = docResult.doc;
    const clearedDoc = { ...doc, uiTracks: [], beat: { pattern: DEFAULT_PATTERN() } };
    await putProjectDocApi(deps.projectId, JSON.stringify(clearedDoc)).catch(() => {});
    const cleanPattern = DEFAULT_PATTERN();
    deps.setTracks([]);
    deps.setSelectedTrack(null);
    deps.setPattern(cleanPattern);
    deps.getSeq()?.setPattern(cleanPattern);
    baselineJson = normalizedProjectJson(clearedDoc);
    deps.setShowNewTrack(true);
    setInitialized(true);
  };

  const save = async () => {
    const seq = deps.getSeq();
    if (!seq) return;
    if (!hasStudioContent(deps.tracks(), seq.getPattern(), deps.lyricsText?.())) return;
    deps.setSaveState("saving");
    try {
      const docResult = await getProjectDocApi(deps.projectId);
      if (!docResult) throw new Error("load failed: could not fetch project doc");
      const doc = docResult.doc;
      const uiTracksForSave = await Promise.all(deps.tracks().map(async t => ({
        ...t,
        clips: await Promise.all((t.clips ?? []).map(async c => ({
          ...c,
          url: undefined,
          ...(await persistedClipFields(c)),
        }))),
      })));
      const updated = {
        ...doc,
        beat: { pattern: seq.getPattern() },
        transport: { ...(doc.transport ?? {}), bpm: deps.bpm(), timeSig: deps.timeSig() },
        musicalKey: deps.musicalKey(),
        uiTracks: uiTracksForSave,
        lyrics: deps.lyricsText?.() ?? (doc.lyrics as string | undefined) ?? "",
      };
      const { json } = fitProjectSavePayload(updated as typeof updated & { uiTracks?: UITrack[] });
      await putProjectDocApi(deps.projectId, json);
      const savedClips = new Map(
        uiTracksForSave.flatMap((track) => (track.clips ?? []).map((clip) => [clip.id, clip] as const)),
      );
      // Preserve object references for clips/tracks that didn't actually change.
      // Solid.js <For> tracks items by reference equality. Creating new objects for
      // unchanged clips causes every Peaks.js waveform to be torn down and rebuilt
      // on every save, producing the visible waveform flash.
      deps.setTracks(deps.tracks().map((track) => {
        if (!track.clips?.length) return track;
        let trackChanged = false;
        const newClips = track.clips.map((clip) => {
          const savedClip = savedClips.get(clip.id);
          if (!savedClip) return clip;
          if (clip.dataUrl === savedClip.dataUrl && clip.remoteUrl === savedClip.remoteUrl) return clip;
          trackChanged = true;
          return { ...clip, dataUrl: savedClip.dataUrl, remoteUrl: savedClip.remoteUrl };
        });
        if (!trackChanged) return track;
        return { ...track, clips: newClips };
      }));
      baselineJson = normalizedProjectJson(updated);
      removeLocalDraft();
      deps.setSaveState("saved");
      setTimeout(() => deps.setSaveState("idle"), 1500);
    } catch (err) {
      console.error(err);
      deps.setError(String(err));
      deps.setSaveState("idle");
    }
  };

  const init = async () => {
    try {
      setInitialized(false);
      const docResult = await getProjectDocApi(deps.projectId);
      if (!docResult) { deps.setError("Couldn't load project"); return; }
      deps.setPublished?.(docResult.published);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc: any = docResult.doc;
      loadedProjectDoc = doc;

      const savedTracks = (doc.uiTracks as UITrack[] | undefined) ?? [];
      const hasContent = hasStudioContent(savedTracks, doc.beat?.pattern, doc.lyrics);

      baselineJson = normalizedProjectJson(doc);

      const draft = readLocalDraft();
      const serverUpdatedAt = Date.parse(doc.updatedAt ?? "");
      const draftIsNewer = draft && (!Number.isFinite(serverUpdatedAt) || draft.updatedAt > serverUpdatedAt);
      if (
        draft
        && draftIsNewer
        && normalizedProjectJson(draft.doc) !== baselineJson
        && hasRecoverableContent(draft.doc)
      ) {
        pendingDoc = draft.doc;
        pendingDocSource = "draft";
        deps.setShowRestoreDialog(true);
      } else if (draft) {
        removeLocalDraft();
      }

      if (!pendingDoc && hasContent) {
        pendingDoc = doc;
        pendingDocSource = "project";
        deps.setShowRestoreDialog(true);
      }

      if (!pendingDoc) {
        await applyDoc(doc);
        setInitialized(true);
      }

      if (!pendingDoc && !hasContent) {
        deps.setShowNewTrack(true);
      }
      clearNewProjectParam();
    } catch (err) {
      deps.setError(String(err));
    }
  };

  createEffect(() => {
    if (!initialized() || applyingDoc || pendingDoc) return;
    const doc = currentDraftDoc();
    const draftJson = normalizedProjectJson(doc);
    if (draftJson === baselineJson) {
      removeLocalDraft();
      clearTimeout(autosaveTimer);
      return;
    }

    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => writeLocalDraft(doc), DRAFT_DEBOUNCE_MS);

    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (deps.saveState() === "saving") return;
      save();
    }, AUTOSAVE_DEBOUNCE_MS);
  });

  if (typeof window !== "undefined") {
    const flushDraft = () => {
      clearTimeout(draftTimer);
      clearTimeout(autosaveTimer);
      writeDraftIfChanged();
    };
    window.addEventListener("pagehide", flushDraft);
    window.addEventListener("beforeunload", flushDraft);
    onCleanup(() => {
      window.removeEventListener("pagehide", flushDraft);
      window.removeEventListener("beforeunload", flushDraft);
    });
  }

  onCleanup(() => {
    clearTimeout(draftTimer);
    clearTimeout(autosaveTimer);
  });

  return { save, restoreSession, discardSession, init };
}
