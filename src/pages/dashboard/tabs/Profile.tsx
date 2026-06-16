import { type Component, For, Show, createEffect, createSignal, onCleanup, onMount, type Accessor } from "solid-js";
import { apiFetch, clipUrl, getLikesApi, likeProjectApi, unlikeProjectApi, publishProjectApi } from "../../../lib/api";
import { getAudioContext } from "../../../lib/audio/context";
import { waveform } from "./waveform";
import "./profile.scss";

interface ProfileProject {
  id: string;
  name: string;
  bpm: number;
  tracks: number;
  updatedAt: string;
  updatedAtRaw: string;
  color: string;
  published: boolean;
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
  gear: "ms_profile_gear",
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
  let allPeaks: number[] = [];

  const draw = () => {
    const canvas = canvasRef;
    if (!canvas || !allPeaks.length || disposed) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (!W || !H) return;

    const BAR_W = 5;
    const GAP = 3;
    const n = Math.max(8, Math.floor(W / (BAR_W + GAP)));

    // Downsample stored peaks to however many bars fit the current width
    const peaks: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.round((i / (n - 1)) * (allPeaks.length - 1));
      peaks.push(allPeaks[idx] ?? 0);
    }

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = props.color;

    for (let i = 0; i < n; i++) {
      const barH = Math.max(3, (peaks[i] ?? 0) * H * 0.88);
      const x = i * (BAR_W + GAP);
      const y = (H - barH) / 2;
      const r = Math.min(BAR_W / 2, 3);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + BAR_W - r, y);
      ctx.arcTo(x + BAR_W, y, x + BAR_W, y + r, r);
      ctx.lineTo(x + BAR_W, y + barH - r);
      ctx.arcTo(x + BAR_W, y + barH, x + BAR_W - r, y + barH, r);
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
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if (disposed) return;

    try {
      const res = await fetch(props.url, { credentials: "include" });
      if (!res.ok || disposed) return;
      const buf = await res.arrayBuffer();
      if (disposed) return;

      const audio = await getAudioContext().decodeAudioData(buf);
      if (disposed) return;

      // Compute 200 buckets upfront — draw() downsamples to whatever fits on screen
      const data = audio.getChannelData(0);
      const BUCKETS = 200;
      const step = Math.floor(data.length / BUCKETS) || 1;
      const stride = Math.max(1, Math.floor(step / 200));
      let max = 0;
      const raw: number[] = [];

      for (let i = 0; i < BUCKETS; i++) {
        let peak = 0;
        const start = i * step;
        const end = Math.min(start + step, data.length);
        for (let j = start; j < end; j += stride) {
          const v = Math.abs(data[j] ?? 0);
          if (v > peak) peak = v;
        }
        raw.push(peak);
        if (peak > max) max = peak;
      }

      if (max > 0 && !disposed) {
        allPeaks = raw.map((p) => p / max);
        draw();

        // Redraw whenever the container resizes (catches late flex layout)
        const ro = new ResizeObserver(() => { if (!disposed) draw(); });
        if (canvasRef) ro.observe(canvasRef);
        onCleanup(() => ro.disconnect());
      }
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

const ActivityChart: Component<{ projects: Accessor<ProfileProject[]> }> = (p) => {
  let containerRef: HTMLDivElement | undefined;
  let chartInst: { dispose: () => void } | null = null;
  const [hovered, setHovered] = createSignal<{ name: string; bpm: number; x: number } | null>(null);
  let pointPixels: number[] = [];

  onCleanup(() => chartInst?.dispose());

  onMount(() => {
    requestAnimationFrame(async () => {
      if (!containerRef) return;
      const echarts = await import("echarts");

      const sorted = [...p.projects()].sort(
        (a, b) => new Date(a.updatedAtRaw).getTime() - new Date(b.updatedAtRaw).getTime()
      );
      if (!sorted.length) return;

      const chart = echarts.init(containerRef, null, { renderer: "svg" });
      chartInst = chart;

      chart.setOption({
        backgroundColor: "transparent",
        grid: { top: 16, right: 16, bottom: 28, left: 32, containLabel: false },
        xAxis: {
          type: "time",
          boundaryGap: false,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(255,255,255,0.45)", fontSize: 8, fontFamily: "JetBrains Mono, monospace", margin: 10,
            formatter: (val: number) => {
              const d = new Date(val);
              return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
            },
          },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)", width: 1, type: [5, 5] } },
        },
        yAxis: {
          type: "value",
          min: 0,
          max: sorted.length,
          interval: 1,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: "rgba(255,255,255,0.45)", fontSize: 8, fontFamily: "JetBrains Mono, monospace" },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)", width: 1, type: [5, 5] } },
        },
        tooltip: { show: false },
        series: [{
          type: "line",
          data: sorted.map((proj, i) => [new Date(proj.updatedAtRaw).getTime(), i + 1]),
          smooth: 0.3,
          smoothMonotone: "x",
          showSymbol: false,
          lineStyle: { color: "#e05297", width: 2.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(224,82,151,0.25)" },
              { offset: 1, color: "rgba(224,82,151,0)" },
            ]),
          },
          emphasis: { scale: false },
        }],
      });

      // pre-compute each point's pixel X position
      pointPixels = sorted.map((proj, i) =>
        ((chart as any).convertToPixel("grid", [new Date(proj.updatedAtRaw).getTime(), i + 1]) as [number, number])[0]
      );
    });
  });

  const onMouseMove = (e: MouseEvent & { currentTarget: HTMLDivElement }) => {
    if (!containerRef || !pointPixels.length) return;
    const rect = containerRef.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < pointPixels.length; i++) {
      const d = Math.abs(pointPixels[i]! - mx);
      if (d < minDist) { minDist = d; closest = i; }
    }
    const proj = p.projects().slice().sort((a, b) => new Date(a.updatedAtRaw).getTime() - new Date(b.updatedAtRaw).getTime())[closest]!;
    setHovered({ name: proj.name, bpm: proj.bpm, x: pointPixels[closest]! });
  };

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative" }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHovered(null)}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <Show when={hovered()}>
        {(h) => (
          <div class="db__pp-chart-hover" style={{ left: `${h().x}px` }}>
            <span class="db__pp-chart-hover-name">{h().name}</span>
            <span class="db__pp-chart-hover-meta">{h().bpm} bpm</span>
          </div>
        )}
      </Show>
    </div>
  );
};

const ProjectBarChart: Component<{
  projects: Accessor<ProfileProject[]>;
  getValue: (p: ProfileProject) => number;
  unit: string;
}> = (p) => {
  let containerRef: HTMLDivElement | undefined;
  let chartInst: { dispose: () => void } | null = null;

  onCleanup(() => chartInst?.dispose());

  onMount(() => {
    requestAnimationFrame(async () => {
      if (!containerRef) return;
      const echarts = await import("echarts");
      const projects = [...p.projects()].sort(
        (a, b) => new Date(a.updatedAtRaw).getTime() - new Date(b.updatedAtRaw).getTime()
      );
      if (!projects.length) return;

      const chart = echarts.init(containerRef, null, { renderer: "svg" });
      chartInst = chart;

      chart.setOption({
        backgroundColor: "transparent",
        grid: { top: 8, right: 8, bottom: 24, left: 32, containLabel: false },
        xAxis: {
          type: "category",
          data: projects.map((pr) => pr.name),
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(255,255,255,0.45)", fontSize: 8, fontFamily: "JetBrains Mono, monospace",
            interval: 0, rotate: projects.length > 6 ? 35 : 0,
            formatter: (v: string) => v.length > 8 ? v.slice(0, 7) + "…" : v,
          },
        },
        yAxis: {
          type: "value",
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: "rgba(255,255,255,0.45)", fontSize: 8, fontFamily: "JetBrains Mono, monospace" },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)", width: 1, type: [5, 5] } },
        },
        tooltip: { show: false },
        series: [{
          type: "bar",
          data: projects.map((pr) => ({
            value: p.getValue(pr),
            itemStyle: { color: pr.color || "#e05297", borderRadius: [3, 3, 0, 0] },
          })),
          barMaxWidth: 28,
          emphasis: {
            itemStyle: { color: "#e05297" },
          },
        }],
      });
    });
  });

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
};

const Profile: Component<ProfileProps> = (props) => {
  const [banner, setBanner] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal("");
  const [editingStatus, setEditingStatus] = createSignal(false);
  const [bio, setBio] = createSignal("");
  const [links, setLinks] = createSignal<string[]>([]);
  const [linkDraft, setLinkDraft] = createSignal("");
  const [view, setView] = createSignal<"music" | "gear" | "activity" | "stats" | "collabs" | "releases">("music");
  const [actMenu, setActMenu] = createSignal<string | null>(null);
  const [likes, setLikes] = createSignal<Record<string, { count: number; liked: boolean }>>({});

  const loadLikes = async () => {
    const published = props.projects().filter((p) => p.published);
    const results: Record<string, { count: number; liked: boolean }> = {};
    await Promise.all(published.map(async (p) => {
      results[p.id] = await getLikesApi(p.id);
    }));
    setLikes(results);
  };

  const toggleLike = async (projectId: string) => {
    const current = likes()[projectId];
    if (!current) return;
    const result = current.liked
      ? await unlikeProjectApi(projectId)
      : await likeProjectApi(projectId);
    setLikes((prev) => ({ ...prev, [projectId]: result }));
  };

  const unpublishProject = async (projectId: string) => {
    await publishProjectApi(projectId, false);
    setActMenu(null);
    window.location.reload();
  };

  const copyShareLink = (projectId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${projectId}`);
    setActMenu(null);
  };

  interface GearItem { category: string; name: string }
  const GEAR_CATEGORIES = ["DAW", "Plugins", "Instruments", "Hardware", "Other"] as const;
  const [gear, setGear] = createSignal<GearItem[]>([]);
  const [gearAdding, setGearAdding] = createSignal<string | null>(null);
  const [gearDraft, setGearDraft] = createSignal("");

  onMount(() => {
    setBanner(localStorage.getItem(BANNER_KEY));
    setStatus(localStorage.getItem(LS.status) ?? "");
    setBio(localStorage.getItem(LS.bio) ?? "");
    setLinks(readList(LS.links));
    try {
      const g = JSON.parse(localStorage.getItem(LS.gear) ?? "[]");
      if (Array.isArray(g)) setGear(g);
    } catch {}
  });

  const handleBannerUpload = (e: Event & { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const isGif = file.type === "image/gif";

    if (isGif) {
      if (file.size > 4 * 1024 * 1024) {
        alert("GIF is too large (max 4MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = evt.target?.result as string;
        try { localStorage.setItem(BANNER_KEY, result); } catch { alert("File too large to save locally"); return; }
        setBanner(result);
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      try { localStorage.setItem(BANNER_KEY, result); } catch { alert("File too large to save locally"); return; }
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

  const saveGear = (items: GearItem[]) => {
    setGear(items);
    localStorage.setItem(LS.gear, JSON.stringify(items));
  };

  const addGearItem = (category: string) => {
    const name = gearDraft().trim();
    if (!name) return;
    saveGear([...gear(), { category, name }]);
    setGearDraft("");
    setGearAdding(null);
  };

  const removeGearItem = (category: string, name: string) => {
    saveGear(gear().filter((g) => !(g.category === category && g.name === name)));
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

  let likesStarted = false;
  createEffect(() => {
    const list = props.projects();
    if (!list.length || urlsStarted) return;
    urlsStarted = true;
    void loadClipUrls(list);
  });
  createEffect(() => {
    const list = props.projects();
    if (!list.length || likesStarted) return;
    if (list.some((p) => p.published)) {
      likesStarted = true;
      void loadLikes();
    }
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
            <input type="file" accept="image/*,.gif,.webp" onChange={handleBannerUpload} />
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
              class={`db__pp-tab${view() === "activity" ? " db__pp-tab--active" : ""}`}
              onClick={() => setView("activity")}
            >Activity</button>
            <button
              class={`db__pp-tab${view() === "stats" ? " db__pp-tab--active" : ""}`}
              onClick={() => setView("stats")}
            >Stats</button>
            <button
              class={`db__pp-tab${view() === "gear" ? " db__pp-tab--active" : ""}`}
              onClick={() => setView("gear")}
            >Gear</button>
            <button
              class={`db__pp-tab${view() === "collabs" ? " db__pp-tab--active" : ""}`}
              onClick={() => setView("collabs")}
            >Collabs</button>
            <button
              class={`db__pp-tab${view() === "releases" ? " db__pp-tab--active" : ""}`}
              onClick={() => setView("releases")}
            >Releases</button>
          </div>

          <Show when={view() === "music"}>
            <Show
              when={props.projects().length > 0}
              fallback={<div class="db__pp-empty">Nothing here yet. Your projects will show up as tracks.</div>}
            >
              <div class="db__pp-feed-wrap"><div class="db__pp-feed" data-lenis-prevent>
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
                            <For each={waveform(p.id, 115)}>
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
              </div></div>
            </Show>
          </Show>

          <Show when={view() === "gear"}>
            <div class="db__pp-placeholder">
              <div class="db__pp-placeholder-group">
                <span class="db__pp-placeholder-cat" />
                <div class="db__pp-placeholder-chips">
                  <span class="db__pp-placeholder-chip" style={{ width: "5.5rem" }} />
                  <span class="db__pp-placeholder-chip" style={{ width: "4rem" }} />
                  <span class="db__pp-placeholder-chip" style={{ width: "6rem" }} />
                </div>
              </div>
              <div class="db__pp-placeholder-group">
                <span class="db__pp-placeholder-cat" />
                <div class="db__pp-placeholder-chips">
                  <span class="db__pp-placeholder-chip" style={{ width: "4.5rem" }} />
                  <span class="db__pp-placeholder-chip" style={{ width: "5rem" }} />
                </div>
              </div>
              <div class="db__pp-placeholder-group">
                <span class="db__pp-placeholder-cat" />
                <div class="db__pp-placeholder-chips">
                  <span class="db__pp-placeholder-chip" style={{ width: "6.5rem" }} />
                  <span class="db__pp-placeholder-chip" style={{ width: "3.5rem" }} />
                  <span class="db__pp-placeholder-chip" style={{ width: "5rem" }} />
                </div>
              </div>
              <span class="db__pp-placeholder-badge">coming soon</span>
            </div>
          </Show>

          <Show when={view() === "activity"}>
            <div class="db__pp-activity">
              <Show
                when={props.projects().filter((p) => p.published && clipUrls()[p.id]).length > 0}
                fallback={<p class="db__pp-empty">No activity yet. Publish a project from the studio.</p>}
              >
                <For each={props.projects().filter((p) => p.published && clipUrls()[p.id])}>
                  {(p) => (
                    <div class="db__pp-act-block">
                      <div class="db__pp-act-block-header">
                        <span class="db__pp-act-block-avatar">
                          <Show when={props.user()?.image} keyed fallback={
                            <span class="db__pp-act-block-init">{props.initials()}</span>
                          }>
                            {(src) => <img src={src} alt="" />}
                          </Show>
                        </span>
                        <div class="db__pp-act-block-meta">
                          <span class="db__pp-act-block-name">{props.user()?.name ?? "You"}</span>
                          <span class="db__pp-act-block-date">{p.updatedAt}</span>
                        </div>
                        <div class="db__pp-act-block-dots-wrap">
                          <button class="db__pp-act-block-dots" onClick={() => setActMenu(actMenu() === p.id ? null : p.id)}>
                            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                          </button>
                          <Show when={actMenu() === p.id}>
                            <div class="db__pp-act-menu">
                              <button onClick={() => copyShareLink(p.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                Copy Link
                              </button>
                              <button onClick={() => props.onOpenProject(p.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit in Studio
                              </button>
                              <button class="db__pp-act-menu-danger" onClick={() => unpublishProject(p.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                                Unpublish
                              </button>
                            </div>
                          </Show>
                        </div>
                      </div>
                      <div class="db__pp-act-block-inner">
                        <div class="db__pp-act-block-top">
                          <span class="db__pp-act-block-cover">
                            <Show when={props.user()?.image} keyed fallback={
                              <span class="db__pp-act-block-cover-init">{props.initials()}</span>
                            }>
                              {(src) => <img src={src} alt="" />}
                            </Show>
                            <span class="db__pp-act-block-play">
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            </span>
                          </span>
                          <div class="db__pp-act-block-info">
                            <div class="db__pp-act-block-title-row">
                              <span class="db__pp-act-block-title">{p.name}</span>
                              <span class="db__pp-act-block-tag">{p.bpm} BPM</span>
                            </div>
                            <span class="db__pp-act-block-artist">{props.user()?.name ?? "You"}</span>
                            <span class="db__pp-act-block-dur">{p.tracks} {p.tracks === 1 ? "track" : "tracks"}</span>
                          </div>
                        </div>
                        <div class="db__pp-act-block-wave">
                          <WaveformCanvas url={clipUrls()[p.id]!} color={p.color} />
                        </div>
                        <div class="db__pp-act-block-foot">
                          <span class="db__pp-act-block-foot-label">Behind the Track</span>
                          <span class="db__pp-act-block-foot-btn" onClick={() => props.onOpenProject(p.id)}>Explore</span>
                        </div>
                      </div>
                      <div class="db__pp-act-block-actions">
                        <button
                          class={`db__pp-act-block-btn${likes()[p.id]?.liked ? " db__pp-act-block-btn--liked" : ""}`}
                          onClick={() => toggleLike(p.id)}
                        >
                          <svg viewBox="0 0 24 24" fill={likes()[p.id]?.liked ? "currentColor" : "none"} stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          <Show when={likes()[p.id]?.count}><span>{likes()[p.id]!.count}</span></Show>
                        </button>
                        <button class="db__pp-act-block-btn" onClick={() => window.open(`/share/${p.id}`, "_blank")}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </button>
                        <button class="db__pp-act-block-btn" onClick={() => copyShareLink(p.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </Show>

          <Show when={view() === "stats"}>
            <div class="db__pp-stats">
              <div class="db__pp-stat-hero">
                <span class="db__pp-stat-hero-num">
                  {props.projects().length
                    ? Math.round(props.projects().reduce((s, p) => s + p.bpm, 0) / props.projects().length)
                    : "—"}
                </span>
                <div class="db__pp-stat-hero-right">
                  <span class="db__pp-stat-hero-unit">BPM</span>
                  <span class="db__pp-stat-hero-sub">average tempo</span>
                </div>
              </div>
              <Show when={props.projects().length > 0}>
                <div class="db__pp-chart-wrap">
                  <span class="db__pp-chart-label">projects over time</span>
                  <div class="db__pp-chart-canvas">
                    <ActivityChart projects={props.projects} />
                  </div>
                </div>
                <div class="db__pp-charts-row">
                  <div class="db__pp-chart-wrap db__pp-chart-wrap--half">
                    <span class="db__pp-chart-label">bpm per project</span>
                    <div class="db__pp-chart-canvas db__pp-chart-canvas--sm">
                      <ProjectBarChart projects={props.projects} getValue={(pr) => pr.bpm} unit="BPM" />
                    </div>
                  </div>
                  <div class="db__pp-chart-wrap db__pp-chart-wrap--half">
                    <span class="db__pp-chart-label">tracks per project</span>
                    <div class="db__pp-chart-canvas db__pp-chart-canvas--sm">
                      <ProjectBarChart projects={props.projects} getValue={(pr) => pr.tracks} unit="tracks" />
                    </div>
                  </div>
                </div>
              </Show>
              <div class="db__pp-stat-footer">
                <span>{props.projects().length}<em> projects</em></span>
                <span class="db__pp-stat-sep">·</span>
                <span>{props.totalTracks()}<em> tracks</em></span>
                <span class="db__pp-stat-sep">·</span>
                <span>{props.fmtStudioTime()}<em> in studio</em></span>
              </div>
            </div>
          </Show>

          <Show when={view() === "collabs"}>
            <div class="db__pp-placeholder">
              <For each={[1, 2, 3]}>
                {() => (
                  <div class="db__pp-placeholder-collab">
                    <span class="db__pp-placeholder-avatar" />
                    <div class="db__pp-placeholder-collab-info">
                      <span class="db__pp-placeholder-bar" style={{ width: "6rem" }} />
                      <span class="db__pp-placeholder-bar db__pp-placeholder-bar--sm" style={{ width: "4rem" }} />
                    </div>
                  </div>
                )}
              </For>
              <span class="db__pp-placeholder-badge">coming soon</span>
            </div>
          </Show>

          <Show when={view() === "releases"}>
            <div class="db__pp-placeholder">
              <div class="db__pp-placeholder-releases">
                <For each={[1, 2, 3]}>
                  {() => (
                    <div class="db__pp-placeholder-release">
                      <span class="db__pp-placeholder-cover" />
                      <span class="db__pp-placeholder-bar" style={{ width: "70%" }} />
                      <span class="db__pp-placeholder-bar db__pp-placeholder-bar--sm" style={{ width: "50%" }} />
                    </div>
                  )}
                </For>
              </div>
              <span class="db__pp-placeholder-badge">coming soon</span>
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
