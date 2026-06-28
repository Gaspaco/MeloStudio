// `[id]` identifies the public project. This page rebuilds its playable mix from
// saved audio, MIDI and drum data when no finished mix file is available.
import { type Component, createEffect, createMemo, createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import gsap from "gsap";
import { Portal } from "solid-js/web";
import { useParams } from "@solidjs/router";
import { getAppSession } from "../../lib/app-auth";
import { apiFetch, transcribeProjectApi, updateProjectApi, getShareProjectApi, pfpUrl as buildPfpUrl, isApiClipUrl, getLikesApi, likeProjectApi, unlikeProjectApi, listCommentsApi, addCommentApi, type ProjectComment } from "~/lib/api";
import "./share.scss";

interface PublicProject {
  id: string;
  name: string;
  bpm: number;
  key: string;
  trackCount: number;
  createdAt?: string;
  updatedAt?: string;
  isOwnerPreview?: boolean;
  ownerId?: string;
  mixUrl?: string | null;
  coverUrl?: string | null;
  durationSec?: number;
  genre?: string;
  description?: string;
  explicit?: boolean;
  lyrics?: string | null;
}

async function fetchPublicProject(id: string): Promise<PublicProject | null> {
  return getShareProjectApi(id) as Promise<PublicProject | null>;
}

/** Flat, desaturated color per project — no gradient. */
function nameToDiscColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(h % 360);
  return `hsl(${hue},28%,16%)`;
}

/** Lighter accent from same hue for the label circle. */
function nameToAccent(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(h % 360);
  return `hsl(${hue},50%,58%)`;
}

/** Up to 2 initials from the project name. */
function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map(w => (w[0] ?? "").toUpperCase())
    .join("") || "M";
}

function buildPeaks(seed: string, count = 300): number[] {
  let rand = 0;
  for (let i = 0; i < seed.length; i++) rand = (rand * 31 + seed.charCodeAt(i)) & 0xffffffff;
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    rand = (rand * 1664525 + 1013904223) & 0xffffffff;
    peaks.push((Math.abs(rand) / 0x7fffffff) * 2 - 1);
  }
  return peaks;
}

function relativeDate(iso?: string): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Background Image Color Hook ──
// Picks the most vibrant (saturated) pixel from the image rather than averaging,
// which avoids the muddy gray result you get from headshots/neutral backgrounds.
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = d / (l > 0.5 ? 2 - max - min : max + min);
  let h = 0;
  if (max === rn)      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else                 h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(hn + 1/3) * 255),
    Math.round(hue2rgb(hn) * 255),
    Math.round(hue2rgb(hn - 1/3) * 255),
  ];
}

function useImageColorExt(imageUrl?: string | null) {
  const [color, setColor] = createSignal<string | null>(null);

  onMount(() => {
    if (!imageUrl) return;
    const img = new Image();
    // crossOrigin required so getImageData doesn't throw a taint error
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const SIZE = 64;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

        // Find most-saturated pixel that isn't too dark or too washed-out
        let bestH = 0, bestS = 0, bestSat = -1;
        let fallbackR = 0, fallbackG = 0, fallbackB = 0, fallbackCount = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
          fallbackR += r; fallbackG += g; fallbackB += b; fallbackCount++;
          const [h, s, l] = rgbToHsl(r, g, b);
          // Skip near-white, near-black, and near-gray pixels
          if (l < 0.12 || l > 0.90 || s < 0.18) continue;
          if (s > bestSat) { bestSat = s; bestH = h; bestS = s; }
        }

        if (bestSat >= 0) {
          // Normalise lightness to 55% so the hue is always vivid — never dark navy or washed pastel
          const [r, g, b] = hslToRgb(bestH, Math.max(bestS, 0.65), 0.55);
          setColor(`rgb(${r},${g},${b})`);
        } else if (fallbackCount > 0) {
          // No vivid pixels — use average as fallback
          setColor(`rgb(${Math.round(fallbackR / fallbackCount)},${Math.round(fallbackG / fallbackCount)},${Math.round(fallbackB / fallbackCount)})`);
        }
      } catch { /* canvas taint or other error — leave color null */ }
    };
    img.src = imageUrl;
  });

  return color;
}
// MediaElement never fires an error that aborts rendering.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

// ── Waveform — crisp white bars, interactive cursor ──────
type WsHandle = { playPause(): void; destroy(): void; on(e: string, cb: (...args: unknown[]) => void): void; seekTo(progress: number): void };

const Waveform: Component<{
  id: string;
  audioUrl?: string | null;
  onReady?: (ws: WsHandle) => void;
}> = (props) => {
  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!containerRef) return;
    const state = { ws: null as null | ReturnType<(typeof import('wavesurfer.js'))['default']['create']> };

    onCleanup(() => state.ws?.destroy());

    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      const audioUrl = props.audioUrl;
      const hasAudio = !!audioUrl;
      const ws = WaveSurfer.create({
        container:     containerRef,
        url:           hasAudio ? audioUrl : SILENT_WAV,
        ...(hasAudio ? {} : {
          peaks:    [buildPeaks(props.id)],
          duration: 180,
        }),
        waveColor:     "rgba(255,255,255,0.75)",
        progressColor: "#e05297",
        barWidth:      2,
        barRadius:     2,
        barGap:        2,
        height:        140,
        interact:      true,
        normalize:     true,
        cursorWidth:   2,
        cursorColor:   "rgba(255,255,255,0.55)",
        fillParent:    true,
      });
      state.ws = ws;
      props.onReady?.(ws);
    });
  });

  return <div ref={containerRef} class="sp__wave-wrap" />;
};

// ── Services data ─────────────────────────────────────────
const SERVICES = [
  {
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2v12M4 8l6-6 6 6M3 17h14"/></svg>,
    name: "Distribute",
    desc: "Release on Spotify, Apple Music, and 150+ stores worldwide.",
    isNew: false,
  },
  {
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 13v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3M10 2v11M6.5 9.5L10 13l3.5-3.5"/></svg>,
    name: "Download",
    desc: "Export as lossless WAV, AIFF, or MP3 in one click.",
    isNew: false,
  },
  {
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2z"/><path d="M7 10h6M10 7v6"/></svg>,
    name: "Song Link",
    desc: "One universal link across all streaming platforms.",
    isNew: true,
  },
  {
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h14M3 10h14M3 15h8"/></svg>,
    name: "Lyrics",
    desc: "Sync and publish timed lyrics with your release.",
    isNew: true,
  },
];

// ── Page ─────────────────────────────────────────────────
const SharePage: Component = () => {
  const params = useParams<{ id: string }>();
  const [project] = createResource(() => params.id, fetchPublicProject);
  const [copied, setCopied] = createSignal(false);
  const [sessionUser] = createResource(async () => {
    return (await getAppSession())?.user ?? null;
  });

  const userInitials = () => {
    const name = sessionUser()?.name ?? "";
    return name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  };

  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copyTimer));
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => setCopied(false), 2400);
  };

  return (
    <div class="sp">
      <nav class="sp__nav">
        <span class="sp__logo" aria-label="MeloStudio">
          <span class="sp__logo-melo">Melo</span><span class="sp__logo-studio">Studio</span>
        </span>
        <div class="sp__nav-group">
          <Show when={sessionUser()} fallback={
            <>
              <a class="sp__nav-link" href="/login">Log In</a>
              <a class="sp__nav-btn" href="/signup">Get Started</a>
            </>
          }>
            <a class="sp__nav-link" href="/dashboard">My Projects</a>
            <div class="sp__nav-divider" />
            <a class="sp__nav-avatar-wrap" href="/dashboard">
              <Show when={sessionUser()?.image} keyed fallback={
                <div class="sp__nav-avatar sp__nav-avatar--initials">
                  {userInitials()}
                </div>
              }>
                {(image) => <img class="sp__nav-avatar" src={image} alt={sessionUser()?.name ?? "User"} referrerpolicy="no-referrer" />}
              </Show>
            </a>
          </Show>
        </div>
      </nav>

      <Show when={project.loading}>
        <div class="sp__state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="32" height="32">
            <path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"/>
          </svg>
          <span>Loading track…</span>
        </div>
      </Show>

      <Show when={!project.loading && !project()}>
        <div class="sp__state sp__state--empty">
          <h2>Track Not Found</h2>
          <p>This project isn't published or the link is invalid.</p>
          <a href="/login">← Sign in to MeloStudio</a>
        </div>
      </Show>

      <Show when={project()}>
        {(p) => {
          const discColor  = nameToDiscColor(p().name);
          const accentColor = nameToAccent(p().name);
          const initials   = nameInitials(p().name);
          const ownerId = p().ownerId;
          const pfpUrl = ownerId ? buildPfpUrl(ownerId) : null;
          const coverImageUrl = p().coverUrl || pfpUrl;
          const extractedColor = useImageColorExt(coverImageUrl);

          const [menuOpen, setMenuOpen] = createSignal(false);
          const [menuRect, setMenuRect] = createSignal({ top: 0, right: 0 });
          const [showDetails, setShowDetails] = createSignal(false);
          const [showSettings, setShowSettings] = createSignal(false);
          const [settingsDesc, setSettingsDesc] = createSignal(p().description || "");
          const [settingsGenre, setSettingsGenre] = createSignal(p().genre || "None");
          const [settingsExplicit, setSettingsExplicit] = createSignal<boolean>(p().explicit || false);

          // ── Synced lyrics (LRCLIB + AudD fingerprinting) ─────────────────
          interface LrcLine { timeSec: number; text: string }
          const [lyricsOpen, setLyricsOpen] = createSignal(false);
          const [lyricsLines, setLyricsLines] = createSignal<LrcLine[]>([]);
          const [lyricsLoading, setLyricsLoading] = createSignal(false);
          const [lyricsErr, setLyricsErr] = createSignal("");
          let lyricsScrollEl: HTMLDivElement | undefined;

          const [likeData, setLikeData] = createSignal({ count: 0, liked: false });
          const [comments, setComments] = createSignal<ProjectComment[]>([]);
          const [commentText, setCommentText] = createSignal("");
          const [commentsOpen, setCommentsOpen] = createSignal(false);

          void getLikesApi(p().id).then(setLikeData);
          void listCommentsApi(p().id).then(setComments);

          const toggleLike = async () => {
            const result = likeData().liked
              ? await unlikeProjectApi(p().id)
              : await likeProjectApi(p().id);
            setLikeData(result);
          };

          const submitComment = async () => {
            const text = commentText().trim();
            if (!text) return;
            const comment = await addCommentApi(p().id, text);
            setComments((prev) => [comment, ...prev]);
            setCommentText("");
          };
          const lyricLineEls: (HTMLParagraphElement | undefined)[] = [];

          const parseLrc = (lrc: string): LrcLine[] => {
            const lines: LrcLine[] = [];

            // Standard multi-line LRC: each line starts with [mm:ss.xx]
            if (lrc.includes("\n")) {
              for (const raw of lrc.split("\n")) {
                const m = raw.match(/^\[(\d+):(\d+\.?\d*)\](.*)/);
                if (m) {
                  const [, minutesRaw, secondsRaw, textRaw] = m;
                  if (!minutesRaw || !secondsRaw || textRaw === undefined) continue;
                  const timeSec = parseInt(minutesRaw) * 60 + parseFloat(secondsRaw);
                  const text = textRaw.trim();
                  if (text) lines.push({ timeSec, text });
                }
              }
              if (lines.length > 0) return lines;
            }

            // Fallback: embedded timestamps in a single line, e.g. [t1]text1[t2]text2...
            const timeRe = /\[(\d+):(\d+\.?\d*)\]/g;
            const stamps: Array<{ timeSec: number; start: number; end: number }> = [];
            let m: RegExpExecArray | null;
            while ((m = timeRe.exec(lrc)) !== null) {
              const [, minutesRaw, secondsRaw] = m;
              if (!minutesRaw || !secondsRaw) continue;
              stamps.push({ timeSec: parseInt(minutesRaw) * 60 + parseFloat(secondsRaw), start: m.index, end: m.index + m[0].length });
            }
            for (let i = 0; i < stamps.length; i++) {
              const stamp = stamps[i];
              if (!stamp) continue;
              const nextStamp = stamps[i + 1];
              const textEnd = nextStamp ? nextStamp.start : lrc.length;
              const text = lrc.slice(stamp.end, textEnd).trim();
              if (text) lines.push({ timeSec: stamp.timeSec, text });
            }

            return lines;
          };


          const openLyrics = async () => {
            setLyricsOpen(true);
            if (lyricsLoading()) return;

            // 1. Use lyrics already saved in the project
            const saved = p().lyrics;
            if (saved?.trim()) {
              if (saved.includes("[") && /\[\d+:\d+/.test(saved)) {
                setLyricsLines(parseLrc(saved));
              } else {
                setLyricsLines(
                  saved.split("\n").filter(Boolean).map((text, i) => ({ timeSec: i * 4, text }))
                );
              }
              return;
            }

            // 2. No saved lyrics — auto-transcribe via Groq Whisper (mix or clips)
            setLyricsLoading(true);
            setLyricsErr("");
            try {
              const { lrc } = await transcribeProjectApi(p().id);
              if (!lrc?.trim()) { setLyricsErr("no-lyrics"); return; }

              // Show lyrics immediately
              if (lrc.includes("[") && /\[\d+:\d+/.test(lrc)) {
                setLyricsLines(parseLrc(lrc));
              } else {
                setLyricsLines(lrc.split("\n").filter(Boolean).map((text, i) => ({ timeSec: i * 4, text })));
              }

              // Cache back to the project if authenticated (non-critical)
              if (p().isOwnerPreview) {
                updateProjectApi(p().id, { lyrics: lrc }).catch(() => { /* ignore */ });
              }
            } catch {
              setLyricsErr("no-lyrics");
            } finally {
              setLyricsLoading(false);
            }
          };

          const [isPlaying, setIsPlaying] = createSignal(false);
          const [playheadSec, setPlayheadSec] = createSignal(0);
          const [totalSec, setTotalSec] = createSignal(0);

          // Cached clips response — pre-fetched on mount so duration shows
          // before play is pressed, and reused by togglePlayback.
          type ClipsData = {
            bpm: number;
            tracks: Array<{ id: string; name: string; type: string; volume: number; muted: boolean; instrumentPreset?: string;
              clips: Array<{
                id: string;
                kind?: "audio" | "video" | "midi";
                startSec: number;
                durationSec: number;
                dataUrl?: string;
                remoteUrl?: string;
                midiNotes?: Array<{ midi: number; startSec: number; durationSec: number; velocity: number }>;
              }>;
            }>;
            durationSec?: number;
            pattern: unknown | null;
          };
          let cachedClipsData: ClipsData | null = null;

          onMount(async () => {
            try {
              const res = await apiFetch(`/api/share-clips/${encodeURIComponent(p().id)}`);
              if (!res.ok) return;
              cachedClipsData = (await res.json()) as ClipsData;
              // Compute real duration from clip metadata
              let maxEndSec = cachedClipsData.durationSec ?? 0;
              for (const track of cachedClipsData.tracks) {
                if (track.muted) continue;
                for (const clip of track.clips) {
                  const end = (clip.startSec ?? 0) + (clip.durationSec ?? 0);
                  if (end > maxEndSec) maxEndSec = end;
                }
              }
              if (maxEndSec > 0) setTotalSec(maxEndSec);
            } catch { /* ignore — duration stays hidden */ }
          });

          const activeLyricIdx = createMemo(() => {
            const lines = lyricsLines();
            const t = playheadSec();
            let idx = -1;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line && line.timeSec <= t) idx = i; else break;
            }
            return idx;
          });

          // Auto-scroll active line into centre of the lyrics panel
          createEffect(() => {
            const idx = activeLyricIdx();
            const lineEl = idx >= 0 ? lyricLineEls[idx] : undefined;
            if (lineEl && lyricsScrollEl) {
              lineEl.scrollIntoView({ block: "center", behavior: "smooth" });
            }
          });
          let wsRef: WsHandle | undefined;
          let rafId = 0;
          let menuRef: HTMLDivElement | undefined;

          // ── Structured share player: audio clips + saved drum pattern ─────
          let audioCtx: AudioContext | undefined;
          let activeSources: AudioBufferSourceNode[] = [];
          let drumSeq: { start(): Promise<void>; stop(): void; dispose(): void } | undefined;
          let midiSynth: { noteOn(midi: number, velocity?: number): void; noteOff(midi: number): void; allNotesOff(): void; dispose(): void } | undefined;
          let midiTimers: ReturnType<typeof setTimeout>[] = [];
          let pausedAt = 0;   // seconds into the timeline where we paused
          let startedAt = 0;  // AudioContext time when play started (minus pausedAt offset)

          const fmtSec = (s: number) => {
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec.toString().padStart(2, "0")}`;
          };

          const stopSources = () => {
            activeSources.forEach((s) => { try { s.stop(0); } catch { /* already ended */ } });
            activeSources = [];
          };

          const stopDrums = () => {
            drumSeq?.stop();
            drumSeq?.dispose();
            drumSeq = undefined;
          };

          const stopMidi = () => {
            for (const timer of midiTimers) clearTimeout(timer);
            midiTimers = [];
            midiSynth?.allNotesOff();
          };

          const stopSharedPlayback = (resetPosition = false) => {
            cancelAnimationFrame(rafId);
            stopSources();
            stopDrums();
            stopMidi();
            setIsPlaying(false);
            if (resetPosition) {
              pausedAt = 0;
              setPlayheadSec(0);
              wsRef?.seekTo(0);
            }
          };

          const tickPlayhead = () => {
            if (!audioCtx || !isPlaying()) return;
            const elapsed = audioCtx.currentTime - startedAt;
            setPlayheadSec(Math.max(0, elapsed));
            const dur = totalSec();
            if (dur > 0) wsRef?.seekTo(Math.min(1, elapsed / dur));
            if (dur > 0 && elapsed >= dur) {
              stopSharedPlayback(true);
              return;
            }
            rafId = requestAnimationFrame(tickPlayhead);
          };

          const togglePlayback = async () => {
            if (isPlaying()) {
              // Pause — record where we are in the timeline
              cancelAnimationFrame(rafId);
              if (audioCtx) pausedAt = audioCtx.currentTime - startedAt;
              setPlayheadSec(pausedAt);
              stopSharedPlayback(false);
              return;
            }

            setIsPlaying(true);

            try {
              // Use cached clips data from pre-fetch, or fetch now if not ready.
              if (!cachedClipsData) {
                const res = await apiFetch(`/api/share-clips/${encodeURIComponent(p().id)}`);
                if (!res.ok) { setIsPlaying(false); return; }
                cachedClipsData = (await res.json()) as ClipsData;
              }
              const { bpm, tracks, durationSec, pattern } = cachedClipsData;

              // Lazy import — browser-only IDB helper
              const { loadClip } = await import("~/lib/clipStore");

              const optionalClipUrl = (url: string) =>
                url.includes("optional=") ? url : `${url}${url.includes("?") ? "&" : "?"}optional=1`;
              const fetchClipBuffer = async (url: string): Promise<ArrayBuffer | null> => {
                const res = isApiClipUrl(url)
                  ? await apiFetch(optionalClipUrl(url)).catch(() => null)
                  : await fetch(url).catch(() => null);
                if (!res || res.status === 204 || !res.ok) return null;
                return res.arrayBuffer().catch(() => null);
              };

              audioCtx ??= new AudioContext();
              if (audioCtx.state === "suspended") await audioCtx.resume();

              const now = audioCtx.currentTime;
              startedAt = now - pausedAt;

              let scheduled = 0;
              let maxEndSec = durationSec ?? 0;

              if (pattern) {
                const { StepSequencer, sanitizePattern } = await import("~/lib/audio/stepSeq");
                stopDrums();
                const cleanPattern = sanitizePattern({ ...(pattern as object), bpm } as Parameters<typeof sanitizePattern>[0]);
                drumSeq = new StepSequencer(cleanPattern);
                await drumSeq.start();
                scheduled++;
              }

              const scheduleMidiTrack = async (track: ClipsData["tracks"][number]) => {
                const midiClips = track.clips.filter((clip) => (clip.kind ?? "audio") === "midi" && clip.midiNotes?.length);
                if (!midiClips.length) return;
                const { PolySynth } = await import("~/lib/audio/synth");
                type SynthPreset = import("~/lib/audio/synth").SynthPreset;
                const { unlockAudioContext } = await import("~/lib/audio/context");
                await unlockAudioContext();
                midiSynth ??= new PolySynth((track.instrumentPreset ?? "piano") as SynthPreset);
                midiSynth.allNotesOff();
                for (const clip of midiClips) {
                  const clipStartSec = clip.startSec ?? 0;
                  const clipEndSec = clipStartSec + (clip.durationSec ?? 0);
                  if (pausedAt > clipEndSec) continue;
                  if (clipEndSec > maxEndSec) maxEndSec = clipEndSec;
                  for (const note of clip.midiNotes ?? []) {
                    const noteStartSec = clipStartSec + note.startSec;
                    const noteEndSec = noteStartSec + note.durationSec;
                    if (pausedAt > noteEndSec) continue;
                    const delayMs = Math.max(0, (noteStartSec - pausedAt) * 1000);
                    const durationMs = Math.max(20, (noteEndSec - Math.max(pausedAt, noteStartSec)) * 1000);
                    const onTimer = setTimeout(() => {
                      midiSynth?.noteOn(note.midi, note.velocity * Math.max(0, Math.min(2, track.volume ?? 1)));
                      const offTimer = setTimeout(() => midiSynth?.noteOff(note.midi), durationMs);
                      midiTimers.push(offTimer);
                    }, delayMs);
                    midiTimers.push(onTimer);
                    scheduled++;
                  }
                }
              };

              for (const track of tracks) {
                if (track.muted) continue;
                await scheduleMidiTrack(track);
                for (const clip of track.clips) {
                  if ((clip.kind ?? "audio") === "midi") continue;
                  const blobUrl = clip.dataUrl ?? clip.remoteUrl ?? await loadClip(clip.id).catch(() => null);
                  if (!blobUrl) continue;

                  const arrayBuf = await fetchClipBuffer(blobUrl);
                  if (!arrayBuf) continue;

                  const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0)).catch(() => null);
                  if (!decoded) continue;


                  const clipStartSec = clip.startSec ?? 0;
                  const clipEndSec = clipStartSec + Math.max(decoded.duration, clip.durationSec ?? 0);
                  if (clipEndSec > maxEndSec) maxEndSec = clipEndSec;
                  // skip clips that are entirely behind the current pause point
                  if (pausedAt > clipEndSec) continue;

                  const src = audioCtx.createBufferSource();
                  src.buffer = decoded;

                  const gain = audioCtx.createGain();
                  gain.gain.value = Math.max(0, Math.min(2, track.volume ?? 1));
                  src.connect(gain);
                  gain.connect(audioCtx.destination);

                  // how far into the clip to start (if we're resuming mid-clip)
                  const clipOffset = Math.max(0, pausedAt - clipStartSec);
                  // when in AudioContext time to start this clip
                  const ctxStartTime = now + Math.max(0, clipStartSec - pausedAt);

                  src.start(ctxStartTime, clipOffset);
                  activeSources.push(src);
                  scheduled++;

                  src.onended = () => {
                    activeSources = activeSources.filter((s) => s !== src);
                    if (activeSources.length === 0 && !drumSeq && isPlaying()) {
                      stopSharedPlayback(true);
                    }
                  };
                }
              }

              if (scheduled === 0) {
                // No playable structure found — visual-only fallback
                setIsPlaying(false);
                pausedAt = 0;
              } else {
                // Start the playhead ticker
                if (maxEndSec > 0) setTotalSec(maxEndSec);
                cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(tickPlayhead);
              }
            } catch (err) {
              console.error("share playback error", err);
              setIsPlaying(false);
            }
          };

          // Cleanup on unmount
          onCleanup(() => {
            cancelAnimationFrame(rafId);
            stopSources();
            stopDrums();
            stopMidi();
            midiSynth?.dispose();
            audioCtx?.close().catch(() => {});
          });

          const handleWsReady = (ws: NonNullable<typeof wsRef>) => {
            wsRef = ws;
            // When user clicks the waveform, seek to that position in the custom audio engine
            ws.on("interaction", (...args: unknown[]) => {
              const dur = totalSec();
              if (dur <= 0) return;
              const currentTimeSec = args[0] as number | undefined;
              if (currentTimeSec == null) return;
              const newPos = Math.max(0, Math.min(dur, currentTimeSec));
              pausedAt = newPos;
              setPlayheadSec(newPos);
              if (isPlaying()) {
                cancelAnimationFrame(rafId);
                stopSources();
                stopDrums();
                stopMidi();
                setIsPlaying(false);
                void togglePlayback();
              }
            });
          };

          return (
            <>
            <Show when={lyricsOpen()}>
              <Portal mount={document.body}>
                <div class="sp__lyrics-backdrop" style={{ "background-image": `url(${coverImageUrl})` }} />
                <div class="sp__lyrics-backdrop-overlay" />
                <button class="sp__lyrics-overlay-close" onClick={() => setLyricsOpen(false)} aria-label="Close lyrics">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </Portal>
            </Show>
            <div class={`sp__layout ${lyricsOpen() ? "sp__layout--lyrics" : ""}`}>
              {/* ── Lyrics Panel ── */}
              <Show when={lyricsOpen()}>
                <div
                  class="sp__lyrics-page"
                  style={{
                    "--card-accent": extractedColor() || accentColor
                  }}
                >
                  <Show when={lyricsLines().length > 0} fallback={
                    <div class="sp__lyrics-empty sp__lyrics-empty--page">
                      <Show when={lyricsLoading()} fallback={
                        <Show when={lyricsErr() === "no-lyrics"}>
                          <p>No lyrics available for this track.</p>
                          <a href={`/studio/${p().id}`} class="sp__lyrics-empty-link">Add lyrics in Studio →</a>
                        </Show>
                      }>
                        <svg class="sp__lyrics-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        <p>Transcribing vocals…</p>
                      </Show>
                    </div>
                  }>
                    <div class="sp__lyrics-scroll" ref={(el) => { lyricsScrollEl = el; }}>
                      <For each={lyricsLines()}>
                      {(line, i) => (
                        <p
                          ref={(el) => (lyricLineEls[i()] = el)}
                          class={`sp__lyrics-line${
                            i() === activeLyricIdx()
                              ? " sp__lyrics-line--active"
                              : i() < activeLyricIdx()
                                ? " sp__lyrics-line--past"
                                : ""
                          }`}
                          onClick={() => {
                            pausedAt = line.timeSec;
                            setPlayheadSec(line.timeSec);
                            if (totalSec() > 0) wsRef?.seekTo(line.timeSec / totalSec());
                            if (isPlaying()) {
                              cancelAnimationFrame(rafId);
                              stopSources();
                              stopDrums();
                              stopMidi();
                              setIsPlaying(false);
                              void togglePlayback();
                            }
                          }}
                        >
                          {line.text}
                        </p>
                      )}
                    </For>
                    </div>
                  </Show>
                </div>
              </Show>

              {/* ── Right Column (Player & Queue) ── */}
              <div class="sp__layout-right">
                {/* ── Player card ── */}
                <div 
                  class="sp__card" 
                  style={{ 
                    "--card-accent": extractedColor() || accentColor,
                    "box-shadow": `0 24px 72px rgba(0,0,0,0.8), 0 0 140px ${extractedColor() || accentColor}99`
                  }}
                >

                <div class="sp__cover">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="Cover" class="sp__cover-img" />
                  ) : (
                    <div class="sp__cover-placeholder" style={{ background: discColor }}>
                      <span class="sp__cover-initials">{initials}</span>
                    </div>
                  )}
                </div>

                <div class="sp__body">
                  <div class="sp__head">
                    <div class="sp__title-row">
                      <h1 class="sp__title">{p().name}</h1>
                      <Show when={p().isOwnerPreview}>
                        <span class="sp__badge">
                          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" width="7" height="7">
                            <rect x="1" y="4.5" width="8" height="5" rx="1"/>
                            <path d="M3 4.5V3a2 2 0 014 0v1.5"/>
                          </svg>
                          Private
                        </span>
                      </Show>
                    </div>
                    <div class="sp__menu-wrap" ref={(el) => { menuRef = el; }}>
                      <button
                        class={`sp__menu${menuOpen() ? " sp__menu--open" : ""}`}
                        aria-label="More options"
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setMenuRect({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                          setMenuOpen((v) => !v);
                        }}
                      >
                        <span/><span/><span/>
                      </button>
                      <Show when={menuOpen()}>
                        <Portal mount={document.body}>
                          <div class="sp__dropdown-overlay" onClick={() => setMenuOpen(false)} />
                          <div
                            class="sp__dropdown"
                            style={{ top: `${menuRect().top}px`, right: `${menuRect().right}px` }}
                          >
                            <button
                              class="sp__dropdown-item"
                              onClick={() => { setMenuOpen(false); setShowDetails(true); }}
                            >
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="14" height="14">
                                <circle cx="8" cy="5.5" r="2.5"/>
                                <path d="M2.5 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5"/>
                              </svg>
                              Project Details
                            </button>
                            <Show when={p().isOwnerPreview}>
                              <button
                                class="sp__dropdown-item"
                                onClick={() => { setMenuOpen(false); setShowSettings(true); }}
                              >
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="14" height="14">
                                  <circle cx="8" cy="8" r="2"/>
                                  <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
                                </svg>
                                Settings
                              </button>
                            </Show>
                          </div>
                        </Portal>
                      </Show>
                    </div>
                  </div>

                  <p class="sp__meta">
                    <span class="sp__meta-artist">MeloStudio</span>
                    <span class="sp__meta-sep">·</span>
                    <span>{relativeDate(p().createdAt || p().updatedAt)}</span>
                    <Show when={p().key && p().key !== "—"}>
                      <span class="sp__meta-sep">·</span>
                      <span>{p().key}</span>
                    </Show>
                  </p>

                  <Waveform id={p().id} audioUrl={p().mixUrl} onReady={handleWsReady} />

                  <p class="sp__dur">
                    <span>{fmtSec(playheadSec())}</span>
                    <span style="opacity:0.35"> / </span>
                    <Show when={totalSec() > 0} fallback={<span>—</span>}>
                      <span>{fmtSec(totalSec())}</span>
                    </Show>
                  </p>

                  <div class="sp__actions">
                    <div class="sp__actions-left">
                      <button class={`sp__btn sp__btn--like${likeData().liked ? " sp__btn--liked" : ""}`} onClick={toggleLike}>
                        <svg viewBox="0 0 24 24" fill={likeData().liked ? "currentColor" : "none"} stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        <Show when={likeData().count}><span class="sp__btn-label">{likeData().count}</span></Show>
                      </button>
                      <button class="sp__btn" onClick={() => setCommentsOpen(!commentsOpen())}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <Show when={comments().length}><span class="sp__btn-label">{comments().length}</span></Show>
                      </button>
                      <button class="sp__btn" onClick={copyLink}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="12" height="12">
                          <path d="M9 2h5v5M14 2l-6 6M7 4H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V9"/>
                        </svg>
                        <span class="sp__btn-label">{copied() ? "Copied!" : "Share"}</span>
                      </button>
                      <Show when={p().isOwnerPreview}>
                        <a class="sp__btn sp__btn--studio" href={`/studio/${p().id}`}>
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" width="12" height="12">
                            <rect x="1" y="1" width="6" height="6" rx="1"/>
                            <rect x="9" y="1" width="6" height="6" rx="1"/>
                            <rect x="1" y="9" width="6" height="6" rx="1"/>
                            <rect x="9" y="9" width="6" height="6" rx="1"/>
                          </svg>
                          <span class="sp__btn-label">Studio</span>
                        </a>
                      </Show>
                    </div>
                  </div>

                  <Show when={commentsOpen()}>
                    <div class="sp__comments">
                      <div class="sp__comments-input">
                        <input
                          type="text"
                          placeholder="Leave feedback..."
                          value={commentText()}
                          onInput={(e) => setCommentText(e.currentTarget.value)}
                          onKeyDown={(e) => e.key === "Enter" && submitComment()}
                        />
                        <button onClick={submitComment} disabled={!commentText().trim()}>Post</button>
                      </div>
                      <Show when={comments().length > 0}>
                        <div class="sp__comments-list">
                          <For each={comments()}>
                            {(c) => (
                              <div class="sp__comment">
                                <img class="sp__comment-avatar" src={buildPfpUrl(c.userId)} alt="" />
                                <div class="sp__comment-body">
                                  <span class="sp__comment-text">{c.body}</span>
                                  <span class="sp__comment-date">{relativeDate(c.createdAt)}</span>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>

              {/* ── What's next ── */}
              <div class="sp__below">
                <div class="sp__below-card">
                  <h3 class="sp__below-title">What's Next?</h3>
                  <div class="sp__services">
                    <For each={SERVICES}>
                      {(s) => (
                        <div
                          class={`sp__service-item${s.name === "Lyrics" ? " sp__service-item--clickable" + (lyricsOpen() ? " sp__service-item--active" : "") : ""}`}
                          onClick={s.name === "Lyrics" ? () => {
                            if (lyricsOpen() && lyricsLines().length > 0) {
                              setLyricsOpen(false); // close if showing results
                            } else {
                              // open (or retry if open but no results yet)
                              setLyricsErr("");
                              void openLyrics();
                            }
                          } : undefined}
                        >
                          <div class="sp__service-circle">
                            {s.icon}
                          </div>
                          <span class="sp__service-label">{s.name}</span>
                          <Show when={s.isNew}>
                            <span class="sp__service-new">New</span>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </div>{/* ── /sp__layout-right ── */}

              {/* ── Project Details modal ── */}
              <Show when={showDetails()}>
                <Portal mount={document.body}>
                  <div class="sp__modal-backdrop" onClick={() => setShowDetails(false)}>
                    <div class="sp__modal" onClick={(e) => e.stopPropagation()}>
                      <div class="sp__modal-header">
                        <button class="sp__modal-close" onClick={() => setShowDetails(false)} aria-label="Close">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16">
                            <path d="M10 3L4 8l6 5"/>
                          </svg>
                        </button>
                        <h2 class="sp__modal-title">Project Details</h2>
                      </div>

                      <div class="sp__modal-project-row">
                        <div class="sp__modal-thumb">
                          {coverImageUrl
                            ? <img src={coverImageUrl} alt={p().name} />
                            : <div class="sp__modal-thumb-placeholder" style={{ background: discColor }}>{initials}</div>
                          }
                        </div>
                        <div class="sp__modal-project-info">
                          <span class="sp__modal-project-name">{p().name}</span>
                          <div class="sp__modal-owner-row">
                            {pfpUrl
                              ? <img class="sp__modal-owner-avatar" src={pfpUrl} alt="Owner" />
                              : <div class="sp__modal-owner-avatar sp__modal-owner-avatar--placeholder">{initials[0]}</div>
                            }
                            <span class="sp__modal-owner-name">{sessionUser()?.name ?? "MeloStudio"}</span>
                          </div>
                        </div>
                        <button class="sp__modal-kebab" aria-label="More">
                          <span/><span/><span/>
                        </button>
                      </div>

                      <div class="sp__modal-collab">
                        <span class="sp__modal-section-label">Collaborators</span>
                        <div class="sp__modal-collab-avatars">
                          {pfpUrl
                            ? <img class="sp__modal-collab-avatar" src={pfpUrl} alt="Owner" />
                            : <div class="sp__modal-collab-avatar sp__modal-collab-avatar--placeholder">{initials[0]}</div>
                          }
                          <button class="sp__modal-collab-add" aria-label="Add collaborator">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                              <path d="M8 3v10M3 8h10"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div class="sp__modal-link-row">
                        <span class="sp__modal-link-hint">Anyone with this link can view this project</span>
                        <button class="sp__modal-copy-btn" onClick={copyLink}>
                          {copied() ? "Copied!" : "Copy Link"}
                        </button>
                      </div>

                      <div class="sp__modal-divider" />

                      <div class="sp__modal-version">
                        <span class="sp__modal-section-label">Current Version</span>
                        <div class="sp__modal-version-card">
                        <div class="sp__modal-version-row">
                          <div class="sp__modal-version-thumb">
                            {coverImageUrl
                              ? <img src={coverImageUrl} alt="" />
                              : <div class="sp__modal-thumb-placeholder" style={{ background: discColor }}>{initials}</div>
                            }
                            <div class="sp__modal-version-play">
                              <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"><path d="M4 2l10 6-10 6V2z"/></svg>
                            </div>
                          </div>
                          <div class="sp__modal-version-info">
                            <span class="sp__modal-version-date">{relativeDate(p().updatedAt)}</span>
                            <div class="sp__modal-version-meta">
                              <Show when={p().isOwnerPreview}>
                                <span class="sp__modal-private">Private</span>
                                <span class="sp__modal-version-sep">·</span>
                              </Show>
                              <span>{sessionUser()?.name ?? "MeloStudio"}</span>
                            </div>
                          </div>
                          <div class="sp__modal-version-controls">
                            <button class="sp__modal-version-icon-btn" aria-label="More">
                              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                                <circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/>
                              </svg>
                            </button>
                            <button class="sp__modal-version-icon-btn" aria-label="Expand">
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                                <path d="M4 6l4 4 4-4"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div class="sp__modal-version-footer">
                          <div class="sp__modal-version-btns">
                            <button class="sp__modal-vbtn" aria-label="Public">
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="16" height="16">
                                <circle cx="8" cy="8" r="6.5"/>
                                <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5M1.5 8h13"/>
                              </svg>
                            </button>
                            <button class="sp__modal-vbtn" aria-label="Share" onClick={copyLink}>
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="16" height="16">
                                <path d="M11 2.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM5 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
                                <path d="M6.9 7.1l2.2-1.3M6.9 9l2.2 1.3"/>
                              </svg>
                            </button>
                            <button class="sp__modal-vbtn" aria-label="Download">
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="16" height="16">
                                <path d="M8 2v8M5 7l3 3 3-3M2.5 12h11"/>
                              </svg>
                            </button>
                          </div>
                          <a class="sp__modal-studio-btn" href={`/studio/${p().id}`}>
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" width="11" height="11">
                              <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
                              <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
                            </svg>
                            Studio
                          </a>
                        </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Portal>
              </Show>

              {/* ── Settings modal ── */}
              <Show when={showSettings()}>
                <Portal mount={document.body}>
                  <div class="sp__modal-backdrop" onClick={() => setShowSettings(false)}>
                    <div class="sp__modal" onClick={(e) => e.stopPropagation()}>
                      <div class="sp__modal-header">
                        <button class="sp__modal-close" onClick={() => setShowSettings(false)} aria-label="Close">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16">
                            <path d="M10 3L4 8l6 5"/>
                          </svg>
                        </button>
                        <div>
                          <h2 class="sp__modal-title">Track Settings</h2>
                          <p class="sp__modal-subtitle">Visibility &amp; metadata</p>
                        </div>
                      </div>

                      <div class="sp__modal-field">
                        <div class="sp__modal-field-header">
                          <label class="sp__modal-label">Description</label>
                          <span class="sp__modal-char-count">{settingsDesc().length} / 250</span>
                        </div>
                        <div class="sp__modal-textarea-wrap">
                          <textarea
                            class="sp__modal-textarea"
                            maxlength="250"
                            placeholder="What's this track about? Add #tags to get discovered..."
                            value={settingsDesc()}
                            onInput={(e) => setSettingsDesc(e.currentTarget.value)}
                          />
                          <span class="sp__modal-emoji">🙂</span>
                        </div>
                      </div>

                      <div class="sp__modal-field">
                        <label class="sp__modal-label">Genre</label>
                        <div class="sp__modal-select-wrap">
                          <select
                            class="sp__modal-select"
                            value={settingsGenre()}
                            onChange={(e) => setSettingsGenre(e.currentTarget.value)}
                          >
                            {["None","Pop","Hip-Hop","R&B","Rock","Electronic","Jazz","Classical","Country","Latin","Progressive Rock","Lo-Fi","Indie","Metal","Folk"].map(g =>
                              <option value={g}>{g}</option>
                            )}
                          </select>
                          <svg class="sp__modal-select-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                            <path d="M4 6l4 4 4-4"/>
                          </svg>
                        </div>
                      </div>

                      <div class="sp__modal-toggle-row">
                        <div class="sp__modal-toggle-info">
                          <span class="sp__modal-label">Explicit Content</span>
                          <p class="sp__modal-hint">Marks this track with an explicit label.</p>
                        </div>
                        <button
                          class={`sp__modal-toggle${settingsExplicit() ? " sp__modal-toggle--on" : ""}`}
                          onClick={() => setSettingsExplicit((v) => !v)}
                          aria-pressed={settingsExplicit()}
                        >
                          <span class="sp__modal-toggle-thumb" />
                        </button>
                      </div>

                      <button
                        class="sp__modal-save"
                        onClick={async () => {
                          try {
                            await updateProjectApi(p().id, {
                              genre: settingsGenre() === "None" ? null : settingsGenre(),
                              description: settingsDesc() || null,
                              explicit: settingsExplicit(),
                            });
                            setShowSettings(false);
                            // Optionally refresh project data here or let reactivity take care of whatever we render
                            window.location.reload();
                          } catch {
                            // Keep the modal open so the user can retry.
                          }
                        }}
                      >Save Changes</button>
                    </div>
                  </div>
                </Portal>
              </Show>
            </div>
            </>
          );
        }}
      </Show>
    </div>
  );
};

export default SharePage;
