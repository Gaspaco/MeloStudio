import { type Component, For, Show, createEffect, createSignal, onMount } from "solid-js";
import { apiFetch } from "../../../lib/api";
import { loadClipBlob } from "../../../lib/clipStore";
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

// ── Real waveform peaks ──────────────────────────────────────────────
const PEAKS_CACHE_KEY = "ms_profile_peaks_v1";
const PEAK_BUCKETS = 36;

const readPeaksCache = (): Record<string, number[]> => {
  try {
    const v = JSON.parse(localStorage.getItem(PEAKS_CACHE_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

interface ClipCandidate { id?: string; dataUrl?: string; remoteUrl?: string }

/** All audio clips in a project doc, in track order. */
const clipCandidates = (doc: any): ClipCandidate[] => {
  const out: ClipCandidate[] = [];
  for (const track of doc?.uiTracks ?? []) {
    for (const clip of track?.clips ?? []) {
      if (!clip || clip.kind === "midi") continue;
      out.push({ id: clip.id, dataUrl: clip.dataUrl, remoteUrl: clip.remoteUrl });
    }
  }
  return out;
};

/** Resolve a clip's audio bytes: inline data, server storage, or local IndexedDB. */
const clipArrayBuffer = async (c: ClipCandidate): Promise<ArrayBuffer | null> => {
  try {
    if (c.dataUrl) return await (await fetch(c.dataUrl)).arrayBuffer();
    if (c.remoteUrl) {
      const res = await apiFetch(c.remoteUrl).catch(() => null);
      if (res?.ok) return await res.arrayBuffer();
    }
    if (c.id) {
      const blob = await loadClipBlob(c.id).catch(() => null);
      if (blob) return await blob.arrayBuffer();
    }
  } catch {}
  return null;
};

const computePeaks = async (buf: ArrayBuffer): Promise<number[] | null> => {
  try {
    const audio = await getAudioContext().decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const step = Math.floor(data.length / PEAK_BUCKETS) || 1;
    const stride = Math.max(1, Math.floor(step / 200));
    const peaks: number[] = [];
    let max = 0;
    for (let b = 0; b < PEAK_BUCKETS; b++) {
      let peak = 0;
      const start = b * step;
      const end = Math.min(start + step, data.length);
      for (let i = start; i < end; i += stride) {
        const v = Math.abs(data[i] ?? 0);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
      if (peak > max) max = peak;
    }
    if (max <= 0) return null;
    return peaks.map((p) => Math.round((p / max) * 100) / 100);
  } catch {
    return null;
  }
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

  // ── Real waveforms from project audio ────────────────────────────
  const [peaks, setPeaks] = createSignal<Record<string, number[]>>({});
  let peaksStarted = false;

  const loadAllPeaks = async (list: ProfileProject[]) => {
    const cache = readPeaksCache();
    const fresh: Record<string, number[]> = {};

    for (const p of list) {
      const key = `${p.id}:${p.updatedAt}`;
      let pk = cache[key] ?? null;
      if (!pk) {
        try {
          const res = await apiFetch(`/api/projects/${p.id}`);
          if (!res.ok) continue;
          const candidates = clipCandidates(await res.json());
          if (!candidates.length) {
            console.info(`[profile] "${p.name}": no audio clips, keeping placeholder`);
            continue;
          }
          for (const c of candidates) {
            const buf = await clipArrayBuffer(c);
            if (!buf) continue;
            pk = await computePeaks(buf);
            if (pk) break;
          }
          if (!pk) console.warn(`[profile] "${p.name}": audio clips found but none decodable`);
        } catch {
          pk = null;
        }
      }
      if (pk) {
        fresh[key] = pk;
        setPeaks((prev) => ({ ...prev, [p.id]: pk }));
      }
    }

    try {
      localStorage.setItem(PEAKS_CACHE_KEY, JSON.stringify(fresh));
    } catch {}
  };

  createEffect(() => {
    const list = props.projects();
    if (!list.length || peaksStarted) return;
    peaksStarted = true;
    void loadAllPeaks(list);
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
                          when={peaks()[p.id]}
                          keyed
                          fallback={
                            <For each={waveform(p.id, 36)}>
                              {(h) => <span class="db__pp-track-wave-ghost" style={{ height: `${Math.round((h / 25) * 100)}%` }} />}
                            </For>
                          }
                        >
                          {(pk) => (
                            <For each={pk}>
                              {(v) => <span style={{ height: `${Math.max(6, Math.round(v * 100))}%` }} />}
                            </For>
                          )}
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
