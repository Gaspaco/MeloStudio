// `useProject` handles the initial data load, parsing, and structured initialization
// of a Studio project when you hit the `/studio/[id]` route. It wraps API calls 
// securely, hydrates the UI state from the DB JSON doc, and resolves legacy tracks 
// into currently supported tracks. It's also fully async via `suspense` in SolidJS,
// putting up a clean loading state until the studio is absolutely ready to play.
import { onMount } from "solid-js";
import { getJWTToken } from "~/lib/auth";
import { unlockAudioContext } from "~/lib/audio/context";
import type { Accessor, Setter } from "solid-js";
import { sanitizePattern, DEFAULT_PATTERN, type StepPattern, type StepSequencer } from "~/lib/audio/stepSeq";
import { PolySynth, type SynthPreset } from "~/lib/audio/synth";
import { loadClip, loadClipBlob, removeClip, storeClip } from "~/lib/clipStore";
import { type MediaClip, type UITrack, TRACK_DEFS } from "../types";

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

  const authHeaders = async (json = false): Promise<Record<string, string>> => {
    const token = await getJWTToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  };

  const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const clipDataUrl = async (clip: MediaClip): Promise<string | undefined> => {
    if (clip.dataUrl) return clip.dataUrl;
    let blob = await loadClipBlob(clip.id).catch(() => null);
    if (!blob && clip.url) blob = await fetch(clip.url).then((res) => res.blob()).catch(() => null);
    return blob ? blobToDataUrl(blob) : undefined;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyDoc = async (doc: any) => {
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

    const savedTracks: UITrack[] | undefined = doc.uiTracks;
    if (savedTracks?.length) {
      const restoredTracks: UITrack[] = [];
      for (const t of savedTracks) {
        if (!TRACK_DEFS.find(d => d.type === t.type)) continue;
        const restoredClips = [];
        for (const clip of t.clips ?? []) {
          if (clip.kind !== "midi") {
            let url = await loadClip(clip.id).catch(() => null);
            if (!url && clip.dataUrl) {
              const blob = await fetch(clip.dataUrl).then((res) => res.blob()).catch(() => null);
              if (blob) {
                await storeClip(clip.id, blob).catch(() => {});
                url = URL.createObjectURL(blob);
              }
            }
            restoredClips.push({ ...clip, url: url ?? undefined });
          } else {
            restoredClips.push(clip);
          }
        }
        restoredTracks.push({ ...t, clips: restoredClips });
        if (t.type === "instrument" || t.type === "bass" || t.type === "guitar") {
          const preset: SynthPreset = t.type === "bass" ? "bass" : t.type === "guitar" ? "guitar" : deps.synthPreset();
          deps.ensureSynth(preset);
          if (t.type === "bass") deps.setSynthPreset("bass");
          else if (t.type === "guitar") deps.setSynthPreset("guitar");
        }
      }
      deps.setTracks(restoredTracks);
      deps.setSelectedTrack(restoredTracks[0]?.id ?? null);
      const hasDrum = restoredTracks.some(t => t.type === "drum");
      const seq = deps.getSeq();
      if (hasDrum && pat?.rows?.length && seq) seq.setPattern(sanitizePattern(pat));
      if (hasDrum) deps.setDrumPanelOpen(true);
    }
  };

  const restoreSession = async () => {
    deps.setShowRestoreDialog(false);
    // Unlock AudioContext within the user-gesture callback so Peaks.js can
    // call decodeAudioData without hitting the browser's autoplay block.
    await unlockAudioContext().catch(() => {});
    if (pendingDoc) await applyDoc(pendingDoc);
    pendingDoc = null;
  };

  const discardSession = async () => {
    deps.setShowRestoreDialog(false);
    if (!pendingDoc) { pendingDoc = null; return; }
    for (const t of (pendingDoc.uiTracks ?? []) as UITrack[]) {
      for (const clip of t.clips ?? []) removeClip(clip.id).catch(() => {});
    }
    pendingDoc = null;
    const headers = await authHeaders().catch(() => null);
    if (!headers) return;
    const res = await fetch(`/api/projects/${deps.projectId}`, { headers, credentials: "include" });
    if (!res.ok) return;
    const doc = await res.json();
    await fetch(`/api/projects/${deps.projectId}`, {
      method: "PUT",
      headers: await authHeaders(true),
      body: JSON.stringify({ ...doc, uiTracks: [], beat: { pattern: DEFAULT_PATTERN() } }),
      credentials: "include",
    });
    deps.setShowNewTrack(true);
  };

  const save = async () => {
    const seq = deps.getSeq();
    if (!seq) return;
    deps.setSaveState("saving");
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("not signed in");
      const res = await fetch(`/api/projects/${deps.projectId}`, { headers, credentials: "include" });
      if (!res.ok) throw new Error(`load failed: ${res.status}`);
      const doc = await res.json();
      const uiTracksForSave = await Promise.all(deps.tracks().map(async t => ({
        ...t,
        clips: await Promise.all((t.clips ?? []).map(async c => ({
          ...c,
          url: undefined,
          dataUrl: c.kind === "midi" ? undefined : await clipDataUrl(c),
        }))),
      })));
      const updated = {
        ...doc,
        beat: { pattern: seq.getPattern() },
        transport: { ...(doc.transport ?? {}), bpm: deps.bpm(), timeSig: deps.timeSig() },
        musicalKey: deps.musicalKey(),
        uiTracks: uiTracksForSave,
        lyrics: deps.lyricsText?.() ?? doc.lyrics ?? "",
      };
      const put = await fetch(`/api/projects/${deps.projectId}`, {
        method: "PUT",
        headers: await authHeaders(true) ?? {},
        body: JSON.stringify(updated),
        credentials: "include",
      });
      if (!put.ok) throw new Error(`save failed: ${put.status}`);
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
      const headers = await authHeaders();
      const res = await fetch(`/api/projects/${deps.projectId}`, { headers, credentials: "include" });
      if (!res.ok) { deps.setError(`Couldn't load (${res.status})`); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      deps.setPublished?.(data._published ?? false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc: any = data;

      const hasTracks = ((doc.uiTracks as UITrack[] | undefined)?.length ?? 0) > 0;
      const hasBeat = (doc.beat?.pattern?.rows as unknown[] | undefined)?.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r.velocities?.some((v: number) => v > 0),
      );

      if (hasTracks || hasBeat) {
        pendingDoc = doc;
        deps.setShowRestoreDialog(true);
      } else {
        await applyDoc(doc);
        deps.setShowNewTrack(true);
        const sp = new URLSearchParams(window.location.search);
        if (sp.get("new") === "1") {
          sp.delete("new");
          window.history.replaceState({}, "", window.location.pathname + (sp.toString() ? `?${sp.toString()}` : ""));
        }
      }
    } catch (err) {
      deps.setError(String(err));
    }
  };

  onMount(() => { /* seq is set by Studio onMount before calling init() */ });

  return { save, restoreSession, discardSession, init };
}
