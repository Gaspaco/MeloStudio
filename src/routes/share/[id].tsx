import { type Component, createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { getJWTToken } from "../../lib/auth";
import "./share.scss";

interface PublicProject {
  id: string;
  name: string;
  bpm: number;
  key: string;
  trackCount: number;
  updatedAt?: string;
  isOwnerPreview?: boolean;
}

async function fetchPublicProject(id: string): Promise<PublicProject | null> {
  let token: string | null = null;
  try { token = await getJWTToken(); } catch { /* unauthenticated */ }
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`/api/share/${id}`, { headers });
  if (!res.ok) return null;
  return res.json();
}

function nameToGradient(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue1 = Math.abs(h % 360);
  const hue2 = (hue1 + 140) % 360;
  return [`hsl(${hue1},58%,52%)`, `hsl(${hue2},55%,40%)`];
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

// Tiny 1-second silent WAV — gives WaveSurfer a valid src so the
// MediaElement never fires an error that aborts rendering.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

// ── Waveform sub-component (browser-only) ────────────────
const Waveform: Component<{ id: string; c1: string; c2: string }> = (props) => {
  let containerRef!: HTMLDivElement;
  let ws: { destroy(): void } | undefined;

  onMount(async () => {
    const { default: WaveSurfer } = await import("wavesurfer.js");

    // Build a vertical CanvasGradient on WaveSurfer's own canvas context.
    // Creating it here on a temp canvas keeps it portable.
    const tmpCanvas = document.createElement("canvas");
    const tmpCtx = tmpCanvas.getContext("2d")!;
    tmpCanvas.height = 64;
    const grad = tmpCtx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0,   "#e05297");
    grad.addColorStop(0.6, "#e05297bb");
    grad.addColorStop(1,   props.c1);

    ws = WaveSurfer.create({
      container:     containerRef,
      // Passing a valid audio URL prevents MediaElement from erroring on
      // empty src — WaveSurfer will still use our peaks array for display.
      url:           SILENT_WAV,
      peaks:         [buildPeaks(props.id)],
      duration:      180,
      waveColor:     grad as unknown as string,
      progressColor: "#e05297" + "44",
      barWidth:      2,
      barRadius:     2,
      barGap:        1,
      height:        64,
      interact:      false,
      normalize:     true,
      cursorWidth:   0,
      fillParent:    true,
    });
  });

  onCleanup(() => ws?.destroy());

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

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  return (
    <div class="sp">
      <nav class="sp__nav">
        <a class="sp__logo" href="/">
          <span class="sp__logo-melo">Melo</span><span class="sp__logo-studio">Studio</span>
        </a>
        <a class="sp__nav-link" href="/">melostudio.app</a>
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
          const [c1, c2] = nameToGradient(p().name);

          return (
            <>
              <div
                class="sp__glow"
                style={{ background: `radial-gradient(ellipse at 55% 0%, ${c1}22 0%, transparent 60%)` }}
              />

              <Show when={p().isOwnerPreview}>
                <div class="sp__banner">
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" width="10" height="10">
                    <rect x="1" y="5.5" width="10" height="6" rx="1"/>
                    <path d="M3.5 5.5V3.5a2.5 2.5 0 015 0v2"/>
                  </svg>
                  Private preview — only you can see this
                </div>
              </Show>

              {/* ── Player card ── */}
              <div class="sp__card">
                <div class="sp__cover">
                  <div class="sp__thumb" style={{ background: `linear-gradient(150deg, ${c1}, ${c2})` }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9" class="sp__thumb-icon">
                      <path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"/>
                    </svg>
                  </div>
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
                    <button class="sp__menu" aria-label="More options">
                      <span/><span/><span/>
                    </button>
                  </div>

                  <p class="sp__meta">
                    <span class="sp__meta-artist">MeloStudio</span>
                    <span class="sp__meta-sep">·</span>
                    <span>{relativeDate(p().updatedAt)}</span>
                    <Show when={p().bpm}>
                      <span class="sp__meta-sep">·</span>
                      <span>{p().bpm} BPM</span>
                    </Show>
                    <Show when={p().key && p().key !== "—"}>
                      <span class="sp__meta-sep">·</span>
                      <span>{p().key}</span>
                    </Show>
                  </p>

                  <p class="sp__dur">{p().trackCount} {p().trackCount === 1 ? "track" : "tracks"}</p>

                  {/* WaveSurfer waveform */}
                  <Waveform id={p().id} c1={c1} c2={c2} />

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
                <p class="sp__section-label">What's next</p>
                <div class="sp__services">
                  <For each={SERVICES}>
                    {(s) => (
                      <div class="sp__service-card">
                        <div class="sp__service-icon">{s.icon}</div>
                        <div class="sp__service-body">
                          <div class="sp__service-name">
                            {s.name}
                            <Show when={s.isNew}>
                              <span class="sp__service-new">New</span>
                            </Show>
                          </div>
                          <p class="sp__service-desc">{s.desc}</p>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              <footer class="sp__footer">
                <a href="/">About</a>
                <span>·</span>
                <a href="/privacy">Privacy</a>
                <span>·</span>
                <a href="/">Terms</a>
                <span>·</span>
                <span>© {new Date().getFullYear()} MeloStudio</span>
              </footer>
            </>
          );
        }}
      </Show>
    </div>
  );
};

export default SharePage;
