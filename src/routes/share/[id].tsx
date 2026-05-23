import { type Component, createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { useParams } from "@solidjs/router";
import { authClient, getJWTToken } from "../../lib/auth";
import { socialAuthClient } from "../../lib/social-auth";
import "./share.scss";

interface PublicProject {
  id: string;
  name: string;
  bpm: number;
  key: string;
  trackCount: number;
  updatedAt?: string;
  isOwnerPreview?: boolean;
  ownerId?: string;
  mixUrl?: string | null;
  durationSec?: number;
}

async function fetchPublicProject(id: string): Promise<PublicProject | null> {
  let token: string | null = null;
  try { token = await getJWTToken(); } catch { /* unauthenticated */ }
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`/api/share/${id}`, { headers });
  if (!res.ok) return null;
  return res.json();
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
  if (!iso) return "Today";
  const d = new Date(iso);
  const diffSec = (Date.now() - d.getTime()) / 1000;
  if (diffSec < 86400 * 1.5) return "Today";
  if (diffSec < 86400 * 7)   return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
          const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
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
type WsHandle = { playPause(): void; destroy(): void; on(e: string, cb: () => void): void; seekTo(progress: number): void };

const Waveform: Component<{
  id: string;
  audioUrl?: string | null;
  onReady?: (ws: WsHandle) => void;
}> = (props) => {
  let containerRef!: HTMLDivElement;

  onMount(() => {
    const state = { ws: null as null | ReturnType<(typeof import('wavesurfer.js'))['default']['create']> };

    onCleanup(() => state.ws?.destroy());

    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      const hasAudio = !!props.audioUrl;
      const ws = WaveSurfer.create({
        container:     containerRef,
        url:           hasAudio ? props.audioUrl! : SILENT_WAV,
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
    const { data } = await authClient.getSession();
    if (data?.user) return data.user;
    const { data: baData } = await socialAuthClient.getSession();
    return baData?.user ?? null;
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
        <a class="sp__logo" href="/">
          <span class="sp__logo-melo">Melo</span><span class="sp__logo-studio">Studio</span>
        </a>
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
              <Show when={sessionUser()?.image} fallback={
                <div class="sp__nav-avatar sp__nav-avatar--initials">
                  {userInitials()}
                </div>
              }>
                <img class="sp__nav-avatar" src={sessionUser()!.image!} alt={sessionUser()?.name ?? "User"} referrerpolicy="no-referrer" />
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
          <a href="/">← Back to MeloStudio</a>
        </div>
      </Show>

      <Show when={project()}>
        {(p) => {
          const discColor  = nameToDiscColor(p().name);
          const accentColor = nameToAccent(p().name);
          const initials   = nameInitials(p().name);
          const pfpUrl = p().ownerId ? `/api/user/${p().ownerId}/pfp` : null;
          const extractedColor = useImageColorExt(pfpUrl);

          const [menuOpen, setMenuOpen] = createSignal(false);
          const [menuRect, setMenuRect] = createSignal({ top: 0, right: 0 });
          const [showDetails, setShowDetails] = createSignal(false);
          const [showSettings, setShowSettings] = createSignal(false);
          const [settingsDesc, setSettingsDesc] = createSignal("");
          const [settingsGenre, setSettingsGenre] = createSignal("None");
          const [settingsExplicit, setSettingsExplicit] = createSignal(false);
          const [isPlaying, setIsPlaying] = createSignal(false);
          const [playheadSec, setPlayheadSec] = createSignal(0);
          const [totalSec, setTotalSec] = createSignal(p().durationSec ?? 0);
          let wsRef: WsHandle | undefined;
          let rafId = 0;
          let menuRef!: HTMLDivElement;

          // ── Structured share player: audio clips + saved drum pattern ─────
          let audioCtx: AudioContext | undefined;
          let activeSources: AudioBufferSourceNode[] = [];
          let drumSeq: { start(): Promise<void>; stop(): void; dispose(): void } | undefined;
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

          const tickPlayhead = () => {
            if (!audioCtx || !isPlaying()) return;
            const elapsed = audioCtx.currentTime - startedAt;
            setPlayheadSec(Math.max(0, elapsed));
            const dur = totalSec();
            if (dur > 0) wsRef?.seekTo(Math.min(1, elapsed / dur));
            rafId = requestAnimationFrame(tickPlayhead);
          };

          const togglePlayback = async () => {
            if (isPlaying()) {
              // Pause — record where we are in the timeline
              cancelAnimationFrame(rafId);
              if (audioCtx) pausedAt = audioCtx.currentTime - startedAt;
              setPlayheadSec(pausedAt);
              stopSources();
              stopDrums();
              setIsPlaying(false);
              return;
            }

            setIsPlaying(true);

            try {
              let clipsToken: string | null = null;
              try { clipsToken = await getJWTToken(); } catch { /* unauthenticated */ }
              const clipsHeaders: HeadersInit = clipsToken ? { Authorization: `Bearer ${clipsToken}` } : {};
              const res = await fetch(`/api/share-clips/${p().id}`, { headers: clipsHeaders });
              if (!res.ok) { setIsPlaying(false); return; }

              const { bpm, tracks, pattern } = (await res.json()) as {
                bpm: number;
                tracks: Array<{
                  id: string; name: string; volume: number; muted: boolean;
                  clips: Array<{ id: string; barStart: number; bars: number }>;
                }>;
                pattern: unknown | null;
              };

              // Lazy import — browser-only IDB helper
              const { loadClip } = await import("~/lib/clipStore");

              audioCtx ??= new AudioContext();
              if (audioCtx.state === "suspended") await audioCtx.resume();

              const secPerBar = (4 * 60) / bpm;
              const now = audioCtx.currentTime;
              startedAt = now - pausedAt;

              let scheduled = 0;
              let maxEndSec = 0;

              if (pattern) {
                const { StepSequencer, sanitizePattern } = await import("~/lib/audio/stepSeq");
                stopDrums();
                const cleanPattern = sanitizePattern({ ...(pattern as object), bpm } as Parameters<typeof sanitizePattern>[0]);
                drumSeq = new StepSequencer(cleanPattern);
                await drumSeq.start();
                scheduled++;
              }

              for (const track of tracks) {
                if (track.muted) continue;
                for (const clip of track.clips) {
                  const blobUrl = await loadClip(clip.id).catch(() => null);
                  if (!blobUrl) continue;

                  const arrayBuf = await fetch(blobUrl).then((r) => r.arrayBuffer()).catch(() => null);
                  if (!arrayBuf) continue;

                  const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0)).catch(() => null);
                  if (!decoded) continue;

                  const clipStartSec = clip.barStart * secPerBar;
                  const clipEndSec = clipStartSec + decoded.duration;
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
                      setIsPlaying(false);
                      pausedAt = 0;
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
            audioCtx?.close().catch(() => {});
          });

          const handleWsReady = (ws: NonNullable<typeof wsRef>) => {
            wsRef = ws;
            // WaveSurfer is visual-only here (no real audio route through it)
          };

          return (
            <>
              {/* ── Player card ── */}
              <div 
                class="sp__card" 
                style={{ 
                  "--card-accent": extractedColor() || accentColor,
                  "box-shadow": `0 24px 72px rgba(0,0,0,0.8), 0 0 140px ${extractedColor() || accentColor}99`
                }}
              >

                {/* Vinyl disc cover */}
                <div class="sp__cover">
                  {pfpUrl ? (
                    <div class="sp__disc-wrap sp__disc-wrap--img">
                      <div 
                        class="sp__disc-bgblur" 
                        style={{ "background-image": `url(${pfpUrl})` }} 
                      />
                      <div class="sp__disc sp__disc--img-pfp" style={{ "animation-play-state": isPlaying() ? "running" : "paused" }}>
                        <img src={pfpUrl} alt="Cover" class="sp__disc-img" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        <div class="sp__disc-r sp__disc-r--a" />
                        <div class="sp__disc-r sp__disc-r--b" />
                        <div class="sp__disc-hole" />
                      </div>
                      <button class="sp__disc-play-btn" aria-label={isPlaying() ? "Pause" : "Play"} onClick={togglePlayback}>
                        <Show when={isPlaying()} fallback={
                          <svg viewBox="0 0 16 16" fill="currentColor" width="20" height="20"><path d="M4 2l10 6-10 6V2z"/></svg>
                        }>
                          <svg viewBox="0 0 16 16" fill="currentColor" width="20" height="20"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>
                        </Show>
                      </button>
                    </div>
                  ) : (
                    <div class="sp__disc-wrap" style={{ background: discColor }}>
                      <div class="sp__disc" style={{ "animation-play-state": isPlaying() ? "running" : "paused" }}>
                        <div class="sp__disc-r sp__disc-r--a" />
                        <div class="sp__disc-r sp__disc-r--b" />
                        <div class="sp__disc-r sp__disc-r--c" />
                        <div class="sp__disc-r sp__disc-r--d" />
                      </div>
                      <div class="sp__disc-lbl" style={{ "--lbl-bg": discColor }}>
                        <span class="sp__disc-initials">{initials}</span>
                        <div class="sp__disc-hole" />
                      </div>
                      <button class="sp__disc-play-btn" aria-label={isPlaying() ? "Pause" : "Play"} onClick={togglePlayback}>
                        <Show when={isPlaying()} fallback={
                          <svg viewBox="0 0 16 16" fill="currentColor" width="20" height="20"><path d="M4 2l10 6-10 6V2z"/></svg>
                        }>
                          <svg viewBox="0 0 16 16" fill="currentColor" width="20" height="20"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>
                        </Show>
                      </button>
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
                    <div class="sp__menu-wrap" ref={menuRef!}>
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
                          </div>
                        </Portal>
                      </Show>
                    </div>
                  </div>

                  <p class="sp__meta">
                    <span class="sp__meta-artist">MeloStudio</span>
                    <span class="sp__meta-sep">·</span>
                    <span>{relativeDate(p().updatedAt)}</span>
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
                      <Show when={p().isOwnerPreview}>
                        <button class="sp__btn sp__btn--primary">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="12" height="12">
                            <circle cx="8" cy="8" r="6.5"/>
                            <path d="M5.5 8h5M8 5.5v5"/>
                          </svg>
                          Publish
                        </button>
                      </Show>
                      <button class="sp__btn" onClick={copyLink}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="12" height="12">
                          <path d="M9 2h5v5M14 2l-6 6M7 4H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V9"/>
                        </svg>
                        {copied() ? "Copied!" : "Share privately"}
                      </button>
                      <button class="sp__btn">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="12" height="12">
                          <path d="M8 2v9M4 8l4 4 4-4M2 14h12"/>
                        </svg>
                        Download
                      </button>
                    </div>
                    <div class="sp__actions-right">
                      <a class="sp__btn sp__btn--studio" href={`/studio/${p().id}`}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" width="12" height="12">
                          <rect x="1" y="1" width="6" height="6" rx="1"/>
                          <rect x="9" y="1" width="6" height="6" rx="1"/>
                          <rect x="1" y="9" width="6" height="6" rx="1"/>
                          <rect x="9" y="9" width="6" height="6" rx="1"/>
                        </svg>
                        Studio
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── What's next ── */}
              <div class="sp__below">
                <div class="sp__below-card">
                  <h3 class="sp__below-title">What's Next?</h3>
                  <div class="sp__services">
                    <For each={SERVICES}>
                      {(s) => (
                        <div class="sp__service-item">
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

              {/* ── CTA banner removed ── */}

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
                          {pfpUrl
                            ? <img src={pfpUrl} alt={p().name} />
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
                            {pfpUrl
                              ? <img src={pfpUrl} alt="" />
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

                      <button class="sp__modal-save">Save Changes</button>
                    </div>
                  </div>
                </Portal>
              </Show>
            </>
          );
        }}
      </Show>
    </div>
  );
};

export default SharePage;
