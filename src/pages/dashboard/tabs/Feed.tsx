// The feed switches between followed creators and public discovery. Changing
// genre, sorting or feed mode reloads projects from the matching API endpoint.
import { type Component, createSignal, createEffect, For, Show, onMount } from "solid-js";
import {
  discoverProjectsApi, getFeedApi, searchUsersApi,
  likeProjectApi, unlikeProjectApi, getLikesApi,
  followUserApi,
  type FeedProject, type DiscoverUser,
} from "~/lib/api";
import { pfpUrl, shareUrl } from "~/lib/api";
import "./feed.scss";

export interface FeedProps {
  onOpenProject: (id: string) => void;
}

const GENRES = ["All", "Hip Hop", "Pop", "R&B", "Rock", "Electronic", "Jazz", "Lo-fi", "Classical", "Afrobeats", "Latin"];

const Feed: Component<FeedProps> = (props) => {
  const [subTab, setSubTab] = createSignal<"following" | "discover">("discover");
  const [projects, setProjects] = createSignal<FeedProject[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [genre, setGenre] = createSignal("All");
  const [sort, setSort] = createSignal<"recent" | "popular">("recent");

  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<DiscoverUser[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searchFocused, setSearchFocused] = createSignal(false);

  const [suggested, setSuggested] = createSignal<DiscoverUser[]>([]);

  const [likes, setLikes] = createSignal<Record<string, { count: number; liked: boolean }>>({});

  let searchTimeout: ReturnType<typeof setTimeout>;

  const loadProjects = async () => {
    setLoading(true);
    try {
      const g = genre() === "All" ? undefined : genre();
      const items = subTab() === "following"
        ? await getFeedApi({ limit: 30 })
        : await discoverProjectsApi({ genre: g, sort: sort(), limit: 30 });
      setProjects(items);

      const likeMap: Record<string, { count: number; liked: boolean }> = {};
      await Promise.all(items.map(async (p) => {
        try {
          likeMap[p.id] = await getLikesApi(p.id);
        } catch {
          likeMap[p.id] = { count: p.likeCount, liked: false };
        }
      }));
      setLikes(likeMap);
    } catch {}
    finally { setLoading(false); }
  };

  onMount(async () => {
    loadProjects();
    try {
      const users = await searchUsersApi("a");
      setSuggested(users.slice(0, 5));
    } catch {}
  });

  createEffect(() => {
    subTab(); genre(); sort();
    loadProjects();
  });

  createEffect(() => {
    const q = searchQuery().trim();
    clearTimeout(searchTimeout);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout = setTimeout(async () => {
      try {
        setSearchResults(await searchUsersApi(q));
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
  });

  const toggleLike = async (projectId: string) => {
    const current = likes()[projectId];
    if (!current) return;
    try {
      const result = current.liked
        ? await unlikeProjectApi(projectId)
        : await likeProjectApi(projectId);
      setLikes((prev) => ({ ...prev, [projectId]: result }));
    } catch {}
  };

  const copyLink = (projectId: string) => {
    navigator.clipboard.writeText(shareUrl(projectId));
  };

  const relativeDate = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(iso).toLocaleDateString();
  };

  const nameInitials = (name: string) => {
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  return (
    <div class="db__content db__content--feed">
      <div class="db__fd-layout">

        {/* ── Main column ───────────────────────────────────── */}
        <main class="db__fd-main">

          {/* Tab switcher */}
          <div class="db__fd-topbar">
            <div class="db__fd-tabs">
              <button
                class={`db__fd-tab${subTab() === "following" ? " db__fd-tab--active" : ""}`}
                onClick={() => setSubTab("following")}
              >Following</button>
              <button
                class={`db__fd-tab${subTab() === "discover" ? " db__fd-tab--active" : ""}`}
                onClick={() => setSubTab("discover")}
              >Discover</button>
            </div>

            <Show when={subTab() === "discover"}>
              <div class="db__fd-sort">
                <button
                  class={`db__fd-sort-btn${sort() === "recent" ? " db__fd-sort-btn--active" : ""}`}
                  onClick={() => setSort("recent")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  Recent
                </button>
                <button
                  class={`db__fd-sort-btn${sort() === "popular" ? " db__fd-sort-btn--active" : ""}`}
                  onClick={() => setSort("popular")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  Trending
                </button>
              </div>
            </Show>
          </div>

          {/* Genre chips */}
          <Show when={subTab() === "discover"}>
            <div class="db__fd-genres">
              <For each={GENRES}>{(g) =>
                <button
                  class={`db__fd-genre${genre() === g ? " db__fd-genre--active" : ""}`}
                  onClick={() => setGenre(g)}
                >{g}</button>
              }</For>
            </div>
          </Show>

          {/* Feed posts */}
          <Show when={!loading()} fallback={
            <div class="db__fd-skels">
              {[1, 2, 3].map(() => (
                <div class="db__fd-skel">
                  <div class="db__fd-skel-header">
                    <div class="db__fd-skel-avatar" />
                    <div class="db__fd-skel-lines">
                      <div class="db__fd-skel-line" style={{ width: "40%" }} />
                      <div class="db__fd-skel-line" style={{ width: "20%" }} />
                    </div>
                  </div>
                  <div class="db__fd-skel-wave" />
                  <div class="db__fd-skel-actions" />
                </div>
              ))}
            </div>
          }>
            <Show when={projects().length > 0} fallback={
              <div class="db__fd-empty">
                <div class="db__fd-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" /></svg>
                </div>
                <h3>{subTab() === "following" ? "Your feed is empty" : "No tracks found"}</h3>
                <p>{subTab() === "following"
                  ? "Follow other creators to see their latest tracks here."
                  : "Try a different genre or check back later."
                }</p>
                <Show when={subTab() === "following"}>
                  <button class="db__fd-empty-cta" onClick={() => setSubTab("discover")}>
                    Discover creators
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </Show>
              </div>
            }>
              <div class="db__fd-posts">
                <For each={projects()}>{(project) => {
                  const l = () => likes()[project.id] ?? { count: project.likeCount, liked: false };
                  return (
                    <article class="db__fd-post">
                      {/* Post header: avatar + name + time */}
                      <div class="db__fd-post-header">
                        <div class="db__fd-post-avatar">
                          <img
                            src={pfpUrl(project.userId)}
                            alt=""
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                        <div class="db__fd-post-author">
                          <span class="db__fd-post-author-name">Creator</span>
                          <span class="db__fd-post-time">
                            published a track · {relativeDate(project.updatedAt as string)}
                          </span>
                        </div>
                        <Show when={project.genre}>
                          <span class="db__fd-post-genre">{project.genre}</span>
                        </Show>
                      </div>

                      {/* Track card */}
                      <div
                        class="db__fd-track"
                        onClick={() => window.open(`/share/${project.id}`, "_blank")}
                      >
                        {/* Cover art */}
                        <div class="db__fd-track-cover">
                          <Show when={project.coverUrl} fallback={
                            <div class="db__fd-track-cover-ph">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" /></svg>
                            </div>
                          }>
                            <img src={project.coverUrl!} alt="" />
                          </Show>
                          <div class="db__fd-track-play">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        </div>

                        {/* Track info + waveform area */}
                        <div class="db__fd-track-body">
                          <div class="db__fd-track-info">
                            <span class="db__fd-track-name">{project.name}</span>
                            <span class="db__fd-track-meta">{project.bpm} BPM</span>
                          </div>
                          {/* Waveform placeholder */}
                          <div class="db__fd-track-wave">
                            <div class="db__fd-track-wave-bars">
                              {Array.from({ length: 60 }, (_, i) => (
                                <span
                                  style={{
                                    height: `${15 + Math.sin(i * 0.4 + (project.name.length || 1)) * 35 + Math.random() * 25}%`,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <Show when={project.description}>
                            <p class="db__fd-track-desc">{project.description}</p>
                          </Show>
                        </div>
                      </div>

                      {/* Action bar */}
                      <div class="db__fd-post-actions">
                        <button
                          class={`db__fd-action${l().liked ? " db__fd-action--liked" : ""}`}
                          onClick={() => toggleLike(project.id)}
                        >
                          <svg viewBox="0 0 24 24" fill={l().liked ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                          <span>{l().count || ""}</span>
                        </button>
                        <button
                          class="db__fd-action"
                          onClick={() => window.open(`/share/${project.id}`, "_blank")}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                          <span>{project.commentCount || ""}</span>
                        </button>
                        <button class="db__fd-action" onClick={() => copyLink(project.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
                        </button>
                        <span class="db__fd-post-listens">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" /></svg>
                          <span>{l().count + project.commentCount} interactions</span>
                        </span>
                      </div>
                    </article>
                  );
                }}</For>
              </div>
            </Show>
          </Show>
        </main>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <aside class="db__fd-sidebar">
          {/* Search */}
          <div class="db__fd-search-wrap">
            <svg class="db__fd-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input
              class="db__fd-search"
              type="text"
              placeholder="Search people..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            />
            <Show when={searchQuery()}>
              <button class="db__fd-search-clear" onClick={() => setSearchQuery("")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </Show>
          </div>

          {/* Search results dropdown */}
          <Show when={searchFocused() && searchQuery().trim().length >= 2}>
            <div class="db__fd-search-results">
              <Show when={!searching()} fallback={
                <div class="db__fd-sb-empty">Searching...</div>
              }>
                <Show when={searchResults().length > 0} fallback={
                  <div class="db__fd-sb-empty">No users found</div>
                }>
                  <For each={searchResults()}>{(user) =>
                    <a class="db__fd-sb-user" href={`/share/${user.id}`} onClick={(e) => e.preventDefault()}>
                      <div class="db__fd-sb-user-avatar">
                        <Show when={user.image} fallback={
                          <span>{nameInitials(user.name)}</span>
                        }>
                          <img src={pfpUrl(user.id)} alt="" />
                        </Show>
                      </div>
                      <div class="db__fd-sb-user-info">
                        <span class="db__fd-sb-user-name">{user.name}</span>
                        <span class="db__fd-sb-user-meta">{user.projectCount} tracks · {user.followerCount} followers</span>
                      </div>
                      <button class="db__fd-sb-follow" onClick={(e) => { e.stopPropagation(); followUserApi(user.id); }}>
                        Follow
                      </button>
                    </a>
                  }</For>
                </Show>
              </Show>
            </div>
          </Show>

          {/* Suggested users */}
          <div class="db__fd-sb-section">
            <h4 class="db__fd-sb-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></svg>
              Who to follow
            </h4>
            <Show when={suggested().length > 0} fallback={
              <div class="db__fd-sb-empty">Follow people to get started</div>
            }>
              <div class="db__fd-sb-list">
                <For each={suggested()}>{(user) =>
                  <div class="db__fd-sb-user">
                    <div class="db__fd-sb-user-avatar">
                      <Show when={user.image} fallback={
                        <span>{nameInitials(user.name)}</span>
                      }>
                        <img src={pfpUrl(user.id)} alt="" />
                      </Show>
                    </div>
                    <div class="db__fd-sb-user-info">
                      <span class="db__fd-sb-user-name">{user.name}</span>
                      <span class="db__fd-sb-user-meta">{user.projectCount} tracks</span>
                    </div>
                    <button class="db__fd-sb-follow" onClick={() => followUserApi(user.id)}>
                      Follow
                    </button>
                  </div>
                }</For>
              </div>
            </Show>
          </div>

          {/* Trending genres */}
          <Show when={subTab() !== "discover"}>
            <div class="db__fd-sb-section">
              <h4 class="db__fd-sb-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                Trending genres
              </h4>
              <div class="db__fd-sb-genres">
                <For each={GENRES.slice(1, 7)}>{(g) =>
                  <button
                    class="db__fd-sb-genre"
                    onClick={() => { setSubTab("discover"); setGenre(g); }}
                  >
                    {g}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                }</For>
              </div>
            </div>
          </Show>

          {/* Footer */}
          <div class="db__fd-sb-footer">
            <span>MeloStudio</span>
            <span class="db__fd-sb-footer-dot" />
            <span>Discover music</span>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default Feed;
