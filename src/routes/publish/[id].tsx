// `[id]` is the project being prepared for publishing. This protected page lets
// its owner toggle public access and copy the matching `/share/[id]` URL.
import { type Component, createResource, createSignal, Show, onCleanup } from "solid-js";
import { useParams } from "@solidjs/router";
import { publishProjectApi, getShareProjectApi, pfpUrl as buildPfpUrl } from "~/lib/api";
import { ProtectedPage } from "~/lib/session";
import "./publish.scss";

interface ProjectInfo {
  id: string;
  name: string;
  bpm: number;
  key: string;
  trackCount: number;
  createdAt?: string;
  updatedAt?: string;
  published?: boolean;
  ownerId?: string;
}

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map(w => (w[0] ?? "").toUpperCase()).join("") || "M";
}

function relativeDate(iso?: string): string {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function nameToDiscColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(h % 360);
  return `hsl(${hue},28%,16%)`;
}

const PublishPageInner: Component = () => {
  const params = useParams<{ id: string }>();

  const [project] = createResource(() => params.id, async (id) => {
    return getShareProjectApi(id) as Promise<ProjectInfo | null>;
  });

  const [published, setPublished] = createSignal<boolean | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [cardFlipped, setCardFlipped] = createSignal(false);

  // Sync published state from loaded project
  createResource(project, (p) => {
    if (p && published() === null) setPublished(p.published ?? false);
  });

  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copyTimer));

  const shareUrl = () => `${window.location.origin}/share/${params.id}`;

  const toggle = async () => {
    setBusy(true);
    setErr("");
    try {
      const next = !published();
      await publishProjectApi(params.id, next);
      setPublished(next);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl());
    setCopied(true);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => setCopied(false), 2400);
  };

  const isPublished = () => published() ?? project()?.published ?? false;

  return (
    <div class="pub">
      <nav class="pub__nav">
        <span class="pub__nav-logo" aria-label="MeloStudio">
          <span class="pub__nav-logo-melo">Melo</span><span class="pub__nav-logo-studio">Studio</span>
        </span>
        <a class="pub__nav-back" href={`/studio/${params.id}`}>
          Back to Studio
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 3L16 8l-6 5"/></svg>
        </a>
      </nav>

      <Show when={!project.loading} fallback={<div style="color:var(--text-secondary,#858078);margin-top:6rem;font-size:0.85rem;">Loading…</div>}>
        <Show when={project()}>
          {(p) => {
            const initials = nameInitials(p().name);
            const discColor = nameToDiscColor(p().name);
            const ownerId = p().ownerId;
            const pfpUrl = ownerId ? buildPfpUrl(ownerId) : null;

            return (
              <div class="pub__layout">
                {/* Hero */}
                <div class="pub__hero">
                  <h1>Publish <span class="pub__hero-accent">Track</span></h1>
                </div>

                {/* Control card */}
                <div class="pub__card">
                  {/* Publish toggle */}
                  <div class="pub__toggle-row">
                    <div class="pub__toggle-info">
                      <h3>Public access</h3>
                      <p>Anyone with the link can play your track — no login required.</p>
                    </div>
                    <button
                      class={`pub__toggle${isPublished() ? " pub__toggle--on" : ""}`}
                      onClick={toggle}
                      disabled={busy()}
                      aria-label={isPublished() ? "Unpublish" : "Publish"}
                    >
                      <div class="pub__toggle-track" />
                      <div class="pub__toggle-thumb" />
                    </button>
                  </div>

                  {/* URL block */}
                  <div class={`pub__url-expand${isPublished() ? " pub__url-expand--open" : ""}`}>
                    <div class="pub__url-expand-inner">
                      <div class="pub__divider" />
                      <div class="pub__url-block">
                        <div class="pub__url-label">Share link</div>
                        <div class="pub__url-row">
                          <div class="pub__url">{shareUrl()}</div>
                          <button class={`pub__copy-btn${copied() ? " pub__copy-btn--copied" : ""}`} onClick={copyLink}>
                            {copied() ? "Copied!" : "Copy link"}
                          </button>
                          <a class="pub__open-btn" href={shareUrl()}>
                            Open
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 2h5v5M14 2l-7 7M6 4H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V9"/></svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Show when={err()}>
                    <div class="pub__err">{err()}</div>
                  </Show>
                </div>

                {/* Printer ticket */}
                <div class="pub__ticket-wrap">
                  <div class="tk__system">
                    <div class="tk__top">
                      <p class="tk__headline">Your track pass has been issued.</p>
                      <div class="tk__printer" />
                    </div>
                    <div class="tk__wrapper">
                      <div class="tk__receipts">
                        <div
                          class={`tk__flip-card${cardFlipped() ? " tk__flip-card--flipped" : ""}`}
                          onClick={() => setCardFlipped(f => !f)}
                        >
                          <div class="tk__flip-inner">
                            {/* Front */}
                            <div class="tk__receipt tk__face--front">
                              <div class="tk__logo">
                                <span class="tk__logo-text"><span class="tk__logo-melo">Melo</span><span class="tk__logo-studio">Studio</span></span>
                                <span class="tk__logo-sub">Track Pass</span>
                              </div>
                              <div class="tk__route">
                                <h2>{p().name?.slice(0, 3).toUpperCase() || "MLO"}</h2>
                                <svg class="tk__music-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                  <path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"/>
                                </svg>
                                <h2>SND</h2>
                              </div>
                              <div class="tk__details">
                                <div class="tk__item">
                                  <span>Track</span>
                                  <h3>{p().name}</h3>
                                </div>
                                <div class="tk__item">
                                  <span>BPM</span>
                                  <h3>{p().bpm || "—"}</h3>
                                </div>
                                <div class="tk__item">
                                  <span>Key</span>
                                  <h3>{p().key && p().key !== "—" ? p().key : "—"}</h3>
                                </div>
                                <div class="tk__item">
                                  <span>Tracks</span>
                                  <h3>{p().trackCount ?? "—"}</h3>
                                </div>
                                <div class="tk__item">
                                  <span>Date</span>
                                  <h3>{relativeDate(p().createdAt || p().updatedAt)}</h3>
                                </div>
                                <div class="tk__item">
                                  <span>ID</span>
                                  <h3>{p().id?.slice(0, 6).toUpperCase()}</h3>
                                </div>
                              </div>
                              <p class="tk__flip-hint">tap to see more ↓</p>
                            </div>

                            {/* Back - QR */}
                            <div class="tk__receipt tk__face--back">
                              <div class="tk__logo">
                                <span class="tk__logo-text"><span class="tk__logo-melo">Melo</span><span class="tk__logo-studio">Studio</span></span>
                                <span class="tk__logo-sub">Track Pass</span>
                              </div>
                              <div class="tk__back-qr-wrap">
                                <svg class="tk__back-qr-lg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29.938 29.938">
                                  <path d="M7.129 15.683h1.427v1.427h1.426v1.426H2.853V17.11h1.426v-2.853h2.853v1.426h-.003zm18.535 12.83h1.424v-1.426h-1.424v1.426zM8.555 15.683h1.426v-1.426H8.555v1.426zm19.957 12.83h1.427v-1.426h-1.427v1.426zm-17.104 1.425h2.85v-1.426h-2.85v1.426zm12.829 0v-1.426H22.81v1.426h1.427zm-5.702 0h1.426v-2.852h-1.426v2.852zM7.129 11.406v1.426h4.277v-1.426H7.129zm-1.424 1.425v-1.426H2.852v2.852h1.426v-1.426h1.427zm4.276-2.852H.002V.001h9.979v9.978zM8.555 1.427H1.426v7.127h7.129V1.427zm-5.703 25.66h4.276V22.81H2.852v4.277zm14.256-1.427v1.427h1.428V25.66h-1.428zM7.129 2.853H2.853v4.275h4.276V2.853zM29.938.001V9.98h-9.979V.001h9.979zm-1.426 1.426h-7.127v7.127h7.127V1.427zM0 19.957h9.98v9.979H0v-9.979zm1.427 8.556h7.129v-7.129H1.427v7.129zm0-17.107H0v7.129h1.427v-7.129zm18.532 7.127v1.424h1.426v-1.424h-1.426zm-4.277 5.703V22.81h-1.425v1.427h-2.85v2.853h2.85v1.426h1.425v-2.853h1.427v-1.426h-1.427v-.001zM11.408 5.704h2.85V4.276h-2.85v1.428zm11.403 11.405h2.854v1.426h1.425v-4.276h-1.425v-2.853h-1.428v4.277h-4.274v1.427h1.426v1.426h1.426V17.11h-.004zm1.426 4.275H22.81v-1.427h-1.426v2.853h-4.276v1.427h2.854v2.853h1.426v1.426h1.426v-2.853h5.701v-1.426h-4.276v-2.853h-.002zm0 0h1.428v-2.851h-1.428v2.851zm-11.405 0v-1.427h1.424v-1.424h1.425v-1.426h1.427v-2.853h4.276v-2.853h-1.426v1.426h-1.426V7.125h-1.426V4.272h1.426V0h-1.426v2.852H15.68V0h-4.276v2.852h1.426V1.426h1.424v2.85h1.426v4.277h1.426v1.426H15.68v2.852h-1.426V9.979H12.83V8.554h-1.426v2.852h1.426v1.426h-1.426v4.278h1.426v-2.853h1.424v2.853H12.83v1.426h-1.426v4.274h2.85v-1.426h-1.422zm15.68 1.426v-1.426h-2.85v1.426h2.85zM27.086 2.853h-4.275v4.275h4.275V2.853zM15.682 21.384h2.854v-1.427h-1.428v-1.424h-1.427v2.851zm2.853-2.851v-1.426h-1.428v1.426h1.428zm8.551-5.702h2.853v-1.426h-2.853v1.426zm1.426 11.405h1.427V22.81h-1.427v1.426zm0-8.553h1.427v-1.426h-1.427v1.426zm-12.83-7.129h-1.425V9.98h1.425V8.554z"/>
                                </svg>
                              </div>
                              <p class="tk__flip-hint">tap to flip back ↑</p>
                            </div>
                          </div>
                        </div>
                        <div class={`tk__stub-wrap${cardFlipped() ? " tk__stub-wrap--flipped" : ""}`}>
                          <div class="tk__stub-inner">
                            <div class="tk__receipt tk__receipt--qr tk__stub-face">
                              <svg class="tk__qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29.938 29.938">
                                <path d="M7.129 15.683h1.427v1.427h1.426v1.426H2.853V17.11h1.426v-2.853h2.853v1.426h-.003zm18.535 12.83h1.424v-1.426h-1.424v1.426zM8.555 15.683h1.426v-1.426H8.555v1.426zm19.957 12.83h1.427v-1.426h-1.427v1.426zm-17.104 1.425h2.85v-1.426h-2.85v1.426zm12.829 0v-1.426H22.81v1.426h1.427zm-5.702 0h1.426v-2.852h-1.426v2.852zM7.129 11.406v1.426h4.277v-1.426H7.129zm-1.424 1.425v-1.426H2.852v2.852h1.426v-1.426h1.427zm4.276-2.852H.002V.001h9.979v9.978zM8.555 1.427H1.426v7.127h7.129V1.427zm-5.703 25.66h4.276V22.81H2.852v4.277zm14.256-1.427v1.427h1.428V25.66h-1.428zM7.129 2.853H2.853v4.275h4.276V2.853zM29.938.001V9.98h-9.979V.001h9.979zm-1.426 1.426h-7.127v7.127h7.127V1.427zM0 19.957h9.98v9.979H0v-9.979zm1.427 8.556h7.129v-7.129H1.427v7.129zm0-17.107H0v7.129h1.427v-7.129zm18.532 7.127v1.424h1.426v-1.424h-1.426zm-4.277 5.703V22.81h-1.425v1.427h-2.85v2.853h2.85v1.426h1.425v-2.853h1.427v-1.426h-1.427v-.001zM11.408 5.704h2.85V4.276h-2.85v1.428zm11.403 11.405h2.854v1.426h1.425v-4.276h-1.425v-2.853h-1.428v4.277h-4.274v1.427h1.426v1.426h1.426V17.11h-.004zm1.426 4.275H22.81v-1.427h-1.426v2.853h-4.276v1.427h2.854v2.853h1.426v1.426h1.426v-2.853h5.701v-1.426h-4.276v-2.853h-.002zm0 0h1.428v-2.851h-1.428v2.851zm-11.405 0v-1.427h1.424v-1.424h1.425v-1.426h1.427v-2.853h4.276v-2.853h-1.426v1.426h-1.426V7.125h-1.426V4.272h1.426V0h-1.426v2.852H15.68V0h-4.276v2.852h1.426V1.426h1.424v2.85h1.426v4.277h1.426v1.426H15.68v2.852h-1.426V9.979H12.83V8.554h-1.426v2.852h1.426v1.426h-1.426v4.278h1.426v-2.853h1.424v2.853H12.83v1.426h-1.426v4.274h2.85v-1.426h-1.422zm15.68 1.426v-1.426h-2.85v1.426h2.85zM27.086 2.853h-4.275v4.275h4.275V2.853zM15.682 21.384h2.854v-1.427h-1.428v-1.424h-1.427v2.851zm2.853-2.851v-1.426h-1.428v1.426h1.428zm8.551-5.702h2.853v-1.426h-2.853v1.426zm1.426 11.405h1.427V22.81h-1.427v1.426zm0-8.553h1.427v-1.426h-1.427v1.426zm-12.83-7.129h-1.425V9.98h1.425V8.554z"/>
                              </svg>
                              <div class="tk__qr-desc">
                                <h2>{p().name}</h2>
                                <p>Show this when requested</p>
                              </div>
                            </div>
                            <div class="tk__receipt tk__receipt--qr tk__stub-face tk__stub-face--back">
                              <div class="tk__actions">
                                <button class="tk__action-btn" onClick={copyLink} title="Copy link">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  <span>Copy</span>
                                </button>
                                <button class="tk__action-btn" onClick={() => { if (typeof navigator !== "undefined" && (navigator as any).share) { (navigator as any).share({ url: shareUrl(), title: p().name }).catch(() => {}); } else { copyLink(); } }} title="Share">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                                  <span>Share</span>
                                </button>
                                <button class="tk__action-btn" onClick={() => { window.location.href = shareUrl(); }} title="Open">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                  <span>Open</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
            );
          }}
        </Show>

        <Show when={!project.loading && !project()}>
          <div style="text-align:center;margin-top:6rem;color:var(--text-secondary,#858078)">
            <p>Project not found.</p>
            <a href="/dashboard" style="color:#e05297;font-size:0.85rem">← Dashboard</a>
          </div>
        </Show>
      </Show>
    </div>
  );
};

const PublishPage: Component = () => (
  <ProtectedPage label="publish">
    <PublishPageInner />
  </ProtectedPage>
);

export default PublishPage;
