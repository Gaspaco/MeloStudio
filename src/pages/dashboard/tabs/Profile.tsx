import { type Component, For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { apiFetch, clipUrl } from "../../../lib/api";
import { getAudioContext } from "../../../lib/audio/context";
import { waveform } from "./waveform";
import "./profile.scss";

interface ProfileProject {
  id: string;
  name: string;
  bpm: number;
  tracks: number;
  updatedAt: string;
  color: string;
}

export interface ProfileProps {
  user: () => { name?: string; email?: string; image?: string; createdAt?: string } | null;
  initials: () => string;
  handleImageUpload: (e: Event & { currentTarget: HTMLInputElement }) => void;
  followCounts: () => { followers: number; following: number };
  projects: () => ProfileProject[];
  totalTracks: () => number;
  fmtStudioTime: () => string;
  onOpenProject: (id: string) => void;
}

const BANNER_KEY = "ms_profile_banner";

const LS = {
  status: "ms_profile_status",
  bio: "ms_profile_bio",
  talents: "ms_profile_talents",
  genres: "ms_profile_genres",
  inspo: "ms_profile_inspo",
  links: "ms_profile_links",
};

const readList = (key: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const writeList = (key: string, v: string[]) => localStorage.setItem(key, JSON.stringify(v));

/** Editable chip list persisted to localStorage. */
const ChipGroup: Component<{ title: string; storageKey: string; placeholder: string }> = (p) => {
  const [items, setItems] = createSignal<string[]>([]);
  const [adding, setAdding] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  onMount(() => setItems(readList(p.storageKey)));

  const commit = () => {
    const v = draft().trim();
    if (v && !items().includes(v)) {
      const next = [...items(), v];
      setItems(next);
      writeList(p.storageKey, next);
    }
    setDraft("");
    setAdding(false);
  };

  const remove = (v: string) => {
    const next = items().filter((x) => x !== v);
    setItems(next);
    writeList(p.storageKey, next);
  };

  return (
    <div class="db__pp-group">
      <h3 class="db__pp-group-title">{p.title}</h3>
      <div class="db__pp-chips">
        <For each={items()}>
          {(it) => (
            <span class="db__pp-chip">
              {it}
              <button class="db__pp-chip-x" onClick={() => remove(it)} title={`Remove ${it}`}>×</button>
            </span>
          )}
        </For>
        <Show
          when={adding()}
          fallback={<button class="db__pp-chip-add" onClick={() => setAdding(true)}>+ Add</button>}
        >
          <input
            class="db__pp-chip-input"
            value={draft()}
            placeholder={p.placeholder}
            ref={(el) => requestAnimationFrame(() => el.focus())}
            onInput={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(""); setAdding(false); }
            }}
            onBlur={commit}
          />
        </Show>
      </div>
    </div>
  );
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Builds fetch URLs for every audio clip in a project doc using the real ProjectDoc schema
const getClipUrls = (doc: any, projectId: string): string[] => {
  const tracks = (doc?.tracks ?? doc?.uiTracks ?? []) as any[];
  const urls: string[] = [];
  for (const track of tracks) {
    for (const clip of (track?.clips ?? []) as any[]) {
      if (clip?.id) urls.push(clipUrl(projectId, clip.id));
    }
  }
  return urls;
};

// ── Custom canvas waveform ────────────────────────────────────────────
const WaveformCanvas: Component<{ url: string; color: string }> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let disposed = false;

  const drawPeaks = (peaks: number[]) => {
    const canvas = canvasRef;
    if (!canvas || disposed) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (!W || !H) return;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const n = peaks.length;
    const BAR_W = 8;
    const GAP = 3;
    const totalW = n * BAR_W + (n - 1) * GAP;
    // If bars overflow the canvas, shrink bar width proportionally
    const scale = totalW > W ? W / totalW : 1;
    const bw = BAR_W * scale;
    const gp = GAP * scale;
    const startX = Math.max(0, (W - (n * bw + (n - 1) * gp)) / 2);

    ctx.fillStyle = props.color;
    for (let i = 0; i < n; i++) {
      const barH = Math.max(3, peaks[i] * H * 0.88);
      const x = startX + i * (bw + gp);
      const y = (H - barH) / 2;
      const r = Math.min(bw / 2, 3);
      // manual rounded rect — avoids browser/TS compatibility issues with ctx.roundRect
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.arcTo(x + bw, y, x + bw, y + r, r);
      ctx.lineTo(x + bw, y + barH - r);
      ctx.arcTo(x + bw, y + barH, x + bw - r, y + barH, r);
      ctx.lineTo(x + r, y + barH);
      ctx.arcTo(x, y + barH, x, y + barH - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
      ctx.fill();
    }
  };

  onMount(async () => {
    if (!canvasRef) return;
    // Wait a frame so the canvas has measured dimensions before drawing
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if (disposed) return;

    try {
      const res = await fetch(props.url, { credentials: "include" });
      if (!res.ok || disposed) return;
      const buf = await res.arrayBuffer();
      if (disposed) return;

      const audio = await getAudioContext().decodeAudioData(buf);
      if (disposed) return;

      const data = audio.getChannelData(0);
      const W = canvasRef.offsetWidth;
      const BAR_W = 8;
      const GAP = 3;
      const n = Math.max(8, Math.floor(W / (BAR_W + GAP)));
      const step = Math.floor(data.length / n) || 1;
      const stride = Math.max(1, Math.floor(step / 200));
      const peaks: number[] = [];
      let max = 0;

      for (let i = 0; i < n; i++) {
        let peak = 0;
        const start = i * step;
        const end = Math.min(start + step, data.length);
        for (let j = start; j < end; j += stride) {
          const v = Math.abs(data[j] ?? 0);
          if (v > peak) peak = v;
        }
        peaks.push(peak);
        if (peak > max) max = peak;
      }

      if (max > 0 && !disposed) drawPeaks(peaks.map((p) => p / max));
    } catch {}
  });

  onCleanup(() => { disposed = true; });

  return (
    <canvas
      ref={(el) => { canvasRef = el; }}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};

const Profile: Component<ProfileProps> = (props) => {
  const [banner, setBanner] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal("");
  const [editingStatus, setEditingStatus] = createSignal(false);
  const [bio, setBio] = createSignal("");
  const [links, setLinks] = createSignal<string[]>([]);
  const [linkDraft, setLinkDraft] = createSignal("");
  const [view, setView] = createSignal<"music" | "about">("music");

  onMount(() => {
    setBanner(localStorage.getItem(BANNER_KEY));
    setStatus(localStorage.getItem(LS.status) ?? "");
    setBio(localStorage.getItem(LS.bio) ?? "");
    setLinks(readList(LS.links));
  });

  const handleBannerUpload = (e: Event & { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      localStorage.setItem(BANNER_KEY, result);
      setBanner(result);
    };
    reader.readAsDataURL(file);
  };

  const saveStatus = (v: string) => {
    const next = v.trim();
    setStatus(next);
    localStorage.setItem(LS.status, next);
    setEditingStatus(false);
  };

  const saveBio = (v: string) => {
    setBio(v);
    localStorage.setItem(LS.bio, v);
  };

  const addLink = () => {
    let v = linkDraft().trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
    if (!links().includes(v)) {
      const next = [...links(), v];
      setLinks(next);
      writeList(LS.links, next);
    }
    setLinkDraft("");
  };

  const removeLink = (url: string) => {
    const next = links().filter((l) => l !== url);
    setLinks(next);
    writeList(LS.links, next);
  };

  const memberSince = () => {
    const raw = props.user()?.createdAt;
    if (!raw) return "—";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  // ── Load first clip URL per project for peaks.js ────────────────
  const [clipUrls, setClipUrls] = createSignal<Record<string, string>>({});
  let urlsStarted = false;

  const loadClipUrls = async (list: ProfileProject[]) => {
    for (const p of list) {
      try {
        const res = await apiFetch(`/api/projects/${p.id}`);
        if (!res.ok) continue;
        const urls = getClipUrls(await res.json(), p.id);
        if (urls[0]) setClipUrls((prev) => ({ ...prev, [p.id]: urls[0]! }));
      } catch {}
    }
  };

  createEffect(() => {
    const list = props.projects();
    if (!list.length || urlsStarted) return;
    urlsStarted = true;
    void loadClipUrls(list);
  });

  return (
    <div class="db__content db__content--profile">
      <div class="db__pro-card">
        {/* Banner — top of card */}
        <div class="db__pro-card-banner">
          <Show when={banner()} keyed fallback={<div class="db__pro-card-banner-placeholder" />}>
            {(src) => <img class="db__pro-card-banner-img" src={src} alt="" />}
          </Show>
          <label class="db__pro-card-banner-upload" title="Change banner">
            <input type="file" accept="image/*" onChange={handleBannerUpload} />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </label>
        </div>

        {/* Card body */}
        <div class="db__pro-card-body">
          <div class="db__pro-card-info">
            {/* Avatar overlaps banner bottom */}
            <div class="db__pro-avatar-wrap">
              <input
                type="file"
                accept="image/*"
                onChange={props.handleImageUpload}
                class="db__profile-upload-input"
                title="Change profile picture"
              />
              <div class="db__pro-avatar">
                <Show when={props.user()?.image} keyed fallback={<span class="db__profile-initials">{props.initials()}</span>}>
                  {(image) => <img class="db__profile-img" src={image} alt="" />}
                </Show>
              </div>
            </div>

            <div class="db__pro-identity">
              <div class="db__pro-name-row">
                <h1 class="db__pro-name">{props.user()?.name ?? "Artist"}</h1>
                <a class="db__pro-edit" href="/settings" title="Edit profile">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" /></svg>
                </a>
              </div>
              <span class="db__pro-handle">@{props.user()?.name?.toLowerCase().replace(/\s+/g, "") ?? "artist"}</span>
            </div>
          </div>

          <div class="db__pro-follow-panel">
              <div class="db__pro-follow-stat">
                <div class="db__pro-follow-avatars">
                  <div class="db__pro-follow-avatar" />
                  <div class="db__pro-follow-avatar" />
                  <div class="db__pro-follow-avatar" />
                </div>
                <div class="db__pro-follow-meta">
                  <span class="db__pro-follow-count">{props.followCounts().followers.toLocaleString()}</span>
                  <span class="db__pro-follow-label">Followers</span>
                </div>
              </div>
              <div class="db__pro-follow-stat">
                <div class="db__pro-follow-avatars">
                  <div class="db__pro-follow-avatar" />
                  <div class="db__pro-follow-avatar" />
                  <div class="db__pro-follow-avatar" />
                </div>
                <div class="db__pro-follow-meta">
                  <span class="db__pro-follow-count">{props.followCounts().following.toLocaleString()}</span>
                  <span class="db__pro-follow-label">Following</span>
                </div>
              </div>
          </div>
        </div>
      </div>

      {/* ── Below the card: feature grid ──────────────────────────── */}
      <div class="db__pp-grid">
        {/* Left: status + about chips */}
        <div class="db__pp-side">
          <div class="db__pp-card">
            <div class="db__pp-group">
              <h3 class="db__pp-group-title">Status</h3>
              <Show
                when={editingStatus()}
                fallback={
                  <button class="db__pp-status" onClick={() => setEditingStatus(true)} title="Set status">
                    <Show when={status()} fallback={<span class="db__pp-status-empty">Set a status</span>}>
                      <span class="db__pp-status-dot" />
                      {status()}
                    </Show>
                  </button>
                }
              >
                <input
                  class="db__pp-status-input"
                  value={status()}
                  list="pp-status-presets"
                  placeholder="What are you up to?"
                  maxlength="40"
                  ref={(el) => requestAnimationFrame(() => el.focus())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveStatus(e.currentTarget.value);
                    if (e.key === "Escape") setEditingStatus(false);
                  }}
                  onBlur={(e) => saveStatus(e.currentTarget.value)}
                />
                <datalist id="pp-status-presets">
                  <option value="In the Studio" />
                  <option value="Open to collab" />
                  <option value="Mixing" />
                  <option value="Taking a break" />
                </datalist>
              </Show>
            </div>
            <ChipGroup title="Talents" storageKey={LS.talents} placeholder="e.g. Beatmaker" />
            <ChipGroup title="Favorite genres" storageKey={LS.genres} placeholder="e.g. Hip Hop" />
            <ChipGroup title="Inspired by" storageKey={LS.inspo} placeholder="e.g. Bruno Mars" />
          </div>
        </div>

        {/* Center: tabs + feed */}
        <div class="db__pp-main">
          <div class="db__pp-tabs">
            <button
              class={`db__pp-tab${view() === "music" ? " db__pp-tab--active" : ""}`}
              onClick={() => setView("music")}
            >Music</button>
            <button
              class={`db__pp-tab${view() === "about" ? " db__pp-tab--active" : ""}`}
              onClick={() => setView("about")}
            >About</button>
          </div>

          <Show when={view() === "music"}>
            <Show
              when={props.projects().length > 0}
              fallback={<div class="db__pp-empty">Nothing here yet. Your projects will show up as tracks.</div>}
            >
              <div class="db__pp-feed">
                <For each={props.projects()}>
                  {(p) => (
                    <button class="db__pp-track" style={{ "--c": p.color }} onClick={() => props.onOpenProject(p.id)}>
                      <span class="db__pp-track-tile">
                        <Show when={props.user()?.image} keyed fallback={<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}>
                          {(src) => (
                            <>
                              <img class="db__pp-track-tile-img" src={src} alt="" />
                              <span class="db__pp-track-tile-play">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                              </span>
                            </>
                          )}
                        </Show>
                      </span>
                      <span class="db__pp-track-info">
                        <span class="db__pp-track-name">{p.name}</span>
                        <span class="db__pp-track-meta">{p.bpm} BPM · {p.tracks} {p.tracks === 1 ? "track" : "tracks"} · {p.updatedAt}</span>
                      </span>
                      <span class="db__pp-track-wave" aria-hidden="true">
                        <Show
                          when={clipUrls()[p.id]}
                          keyed
                          fallback={
                            <For each={waveform(p.id, 64)}>
                              {(h) => <span class="db__pp-track-wave-ghost" style={{ height: `${Math.round((h / 25) * 100)}%` }} />}
                            </For>
                          }
                        >
                          {(url) => <WaveformCanvas url={url} color={p.color} />}
                        </Show>
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          <Show when={view() === "about"}>
            <div class="db__pp-about">
              <textarea
                class="db__pp-bio"
                placeholder="Tell people what you make."
                rows="4"
                value={bio()}
                onBlur={(e) => saveBio(e.currentTarget.value)}
              />
              <div class="db__pp-facts">
                <div class="db__pp-fact">
                  <span class="db__pp-fact-label">Member since</span>
                  <span class="db__pp-fact-value">{memberSince()}</span>
                </div>
                <div class="db__pp-fact">
                  <span class="db__pp-fact-label">Studio time</span>
                  <span class="db__pp-fact-value">{props.fmtStudioTime()}</span>
                </div>
                <div class="db__pp-fact">
                  <span class="db__pp-fact-label">Projects</span>
                  <span class="db__pp-fact-value">{props.projects().length}</span>
                </div>
                <div class="db__pp-fact">
                  <span class="db__pp-fact-label">Tracks</span>
                  <span class="db__pp-fact-value">{props.totalTracks()}</span>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Right: links */}
        <aside class="db__pp-rail">
          <div class="db__pp-card">
            <h3 class="db__pp-group-title">Find me on</h3>
            <Show when={links().length > 0} fallback={<p class="db__pp-rail-hint">Add links to your music and socials.</p>}>
              <div class="db__pp-links">
                <For each={links()}>
                  {(url) => (
                    <div class="db__pp-link-row">
                      <a class="db__pp-link" href={url} target="_blank" rel="noreferrer">
                        <span class="db__pp-link-host">{hostOf(url)}</span>
                      </a>
                      <button class="db__pp-link-x" onClick={() => removeLink(url)} title="Remove link">×</button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <input
              class="db__pp-link-input"
              value={linkDraft()}
              placeholder="Paste a link, press Enter"
              onInput={(e) => setLinkDraft(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addLink(); }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Profile;
