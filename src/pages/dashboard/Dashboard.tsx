// Keep the dashboard data and shared tab state in one place.
import { type Component, createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { gsap } from "gsap";
import { authClient } from "../../lib/auth";
import { getAppSession, signOutApp } from "../../lib/app-auth";
import {
  listProjectsApi, deleteProjectApi, updateProjectApi,
  getProjectStatsApi, listDeletedProjectsApi, restoreProjectApi,
  permanentlyDeleteProjectApi, getFollowCountsApi, type DeletedProjectListItem,
} from "../../lib/api";
import Library from "./tabs/Library";
import Profile from "./tabs/Profile";
import Feed from "./tabs/Feed";
import NotificationsDropdown from "./components/NotificationsDropdown";
import "./dashboard.scss";

interface Project {
  id: string;
  name: string;
  bpm: number;
  key: string;
  tracks: number;
  updatedAt: string;
  updatedAtRaw: string;
  color: string;
  published: boolean;
}

type Tab = "home" | "profile" | "library";

const Dashboard: Component<{
  onLogout: () => void;
  onNewProject: (name?: string) => void;
  onOpenProject: (id: string) => void;
}> = (props) => {
  let pageRef: HTMLDivElement | undefined;

  // ── Auth / user ────────────────────────────────────────────────────
  const [user, setUser] = createSignal<{
    name?: string; email?: string; image?: string; createdAt?: string;
  } | null>(null);

  // ── Projects ───────────────────────────────────────────────────────
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = createSignal(true);
  const [studioHours, setStudioHours] = createSignal(0);
  const [followCounts, setFollowCounts] = createSignal({ followers: 0, following: 0 });

  // ── UI state ───────────────────────────────────────────────────────
  const [time, setTime] = createSignal(new Date());
  const [tab, setTab] = createSignal<Tab>("home");

  // ── Library state ──────────────────────────────────────────────────
  const [libCat, setLibCat] = createSignal<"all" | "mine" | "liked" | "deleted">("all");
  const [libSearch, setLibSearch] = createSignal("");
  const tabRefs: Partial<Record<string, HTMLButtonElement>> = {};
  const [tabInd, setTabInd] = createSignal({ left: 0, width: 0, isTrash: false });
  createEffect(() => {
    const cat = libCat();
    // rAF defers the offsetLeft read until SolidJS has re-rendered the active tab, avoiding stale geometry
    requestAnimationFrame(() => {
      const el = tabRefs[cat];
      if (el) setTabInd({ left: el.offsetLeft, width: el.offsetWidth, isTrash: cat === "deleted" });
    });
  });

  // ── Account delete ─────────────────────────────────────────────────
  const [deleteStep, setDeleteStep] = createSignal<"none" | "confirm" | "password">("none");
  const [deletePassword, setDeletePassword] = createSignal("");
  const [deleteLoading, setDeleteLoading] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");

  // ── Project modals ─────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = createSignal(false);
  const [createName, setCreateName] = createSignal("New Project");
  const [renameTarget, setRenameTarget] = createSignal<Project | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [deleteTarget, setDeleteTarget] = createSignal<Project | null>(null);
  const [projectActionError, setProjectActionError] = createSignal("");
  const [projectActionLoading, setProjectActionLoading] = createSignal(false);

  // ── Context menu ───────────────────────────────────────────────────
  const [menuProjectId, setMenuProjectId] = createSignal<string | null>(null);
  const closeMenu = () => setMenuProjectId(null);
  const toggleMenu = (e: Event, id: string) => {
    e.stopPropagation();
    setMenuProjectId((prev) => (prev === id ? null : id));
  };

  // ── Trash ──────────────────────────────────────────────────────────
  const [deletedProjects, setDeletedProjects] = createSignal<DeletedProjectListItem[]>([]);
  const [deletedLoading, setDeletedLoading] = createSignal(false);
  const [permDeleteTarget, setPermDeleteTarget] = createSignal<DeletedProjectListItem | null>(null);
  const [permDeleteLoading, setPermDeleteLoading] = createSignal(false);
  const [trashActionError, setTrashActionError] = createSignal("");

  // ── Data loading ───────────────────────────────────────────────────
  onMount(async () => {
    try {
      const userData = (await getAppSession())?.user;
      if (userData) {
        const rawImage = userData.image ?? undefined;
        // Twitter/X profile images default to `_normal` (48px) — replace with `_400x400` for higher-res display
        const image = rawImage?.replace(/_normal(\.[^.]+)$/, "_400x400$1") ?? rawImage;
        setUser({
          name: userData.name,
          email: userData.email,
          image,
          createdAt: typeof userData.createdAt === "string"
            ? userData.createdAt
            : (userData.createdAt as any)?.toISOString?.() ?? undefined,
        });
      }
    } catch {}

    try {
      const list = await listProjectsApi();
      const PROJECT_COLORS = ["#e05297", "#7c5cff", "#ff5454", "#14f195", "#00d2ff", "#ffaa00", "#ff00ff", "#a3ff00"];
      setProjects(list.map((p, i) => ({
        id: p.id, name: p.name, bpm: p.bpm, key: "—",
        tracks: p.trackCount,
        updatedAt: new Date(p.updatedAt).toLocaleDateString(),
        updatedAtRaw: p.updatedAt as string,
        color: PROJECT_COLORS[i % PROJECT_COLORS.length] as string,
        published: p.published ?? false,
      })));
      const stats = await getProjectStatsApi();
      setStudioHours(stats.studioHours);
      const fc = await getFollowCountsApi();
      setFollowCounts(fc);
    } catch {}
    finally { setLoadingProjects(false); }
  });

  // ── Clock + ESC handler ────────────────────────────────────────────
  onMount(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (createOpen()) setCreateOpen(false);
        if (renameTarget()) setRenameTarget(null);
        if (deleteTarget()) setDeleteTarget(null);
        if (permDeleteTarget()) setPermDeleteTarget(null);
        if (menuProjectId()) setMenuProjectId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => { clearInterval(interval); window.removeEventListener("keydown", onKey); });
  });

  // ── Entrance animation ─────────────────────────────────────────────
  onMount(() => {
    if (!pageRef) return;
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo(pageRef, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    tl.fromTo(".db__bar", { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.1);
    tl.fromTo(".db__content", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9 }, 0.3);
  });

  // ── Auth ───────────────────────────────────────────────────────────
  const handleLogout = async () => { await signOutApp(); props.onLogout(); };

  const handleImageUpload = (e: Event & { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const result = evt.target?.result as string;
        try { await authClient.updateUser({ image: result }); } catch {}
        setUser((u) => (u ? { ...u, image: result } : u));
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Computed values ────────────────────────────────────────────────
  const formatTime = () =>
    time().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  const greeting = () => {
    const h = time().getHours();
    if (h < 12) return "Morning";
    if (h < 18) return "Afternoon";
    return "Evening";
  };

  const firstName = () => user()?.name?.split(" ")[0] ?? "Creator";

  const initials = () => {
    const n = user()?.name ?? "?";
    const parts = n.split(" ");
    return parts.length > 1
      ? ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  };

  const totalTracks = () => projects().reduce((a, p) => a + p.tracks, 0);

  const fmtStudioTime = () => {
    const h = studioHours();
    if (h <= 0) return "0m";
    if (h < 1) return `${Math.floor(h * 60)}m`;
    const hrs = Math.floor(h);
    const mins = Math.floor((h - hrs) * 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  // ── Project handlers ───────────────────────────────────────────────
  const openCreate = () => { setCreateName("New Project"); setProjectActionError(""); setCreateOpen(true); };

  const submitCreate = (e: Event) => {
    e.preventDefault();
    const n = createName().trim();
    if (!n) { setProjectActionError("Name is required."); return; }
    setCreateOpen(false);
    props.onNewProject(n);
  };

  const openRename = (e: Event, project: Project) => {
    e.stopPropagation();
    setRenameTarget(project);
    setRenameValue(project.name);
    setProjectActionError("");
  };

  const submitRename = async (e: Event) => {
    e.preventDefault();
    const target = renameTarget();
    if (!target) return;
    const next = renameValue().trim();
    if (!next) { setProjectActionError("Name is required."); return; }
    if (next === target.name) { setRenameTarget(null); return; }
    setProjectActionLoading(true);
    setProjectActionError("");
    try {
      await updateProjectApi(target.id, { name: next });
      setProjects((prev) => prev.map((p) => p.id === target.id ? { ...p, name: next } : p));
      setRenameTarget(null);
    } catch { setProjectActionError("Failed to rename project."); }
    finally { setProjectActionLoading(false); }
  };

  const openDelete = (e: Event, project: Project) => {
    e.stopPropagation();
    setDeleteTarget(project);
    setProjectActionError("");
  };

  const submitDelete = async () => {
    const target = deleteTarget();
    if (!target) return;
    setProjectActionLoading(true);
    setProjectActionError("");
    try {
      await deleteProjectApi(target.id);
      setProjects((prev) => prev.filter((p) => p.id !== target.id));
      setDeleteTarget(null);
    } catch { setProjectActionError("Failed to delete project."); }
    finally { setProjectActionLoading(false); }
  };

  // ── Trash handlers ─────────────────────────────────────────────────
  const loadDeletedProjects = async () => {
    setDeletedLoading(true);
    try { setDeletedProjects(await listDeletedProjectsApi()); }
    catch {}
    finally { setDeletedLoading(false); }
  };

  const handleRestore = async (item: DeletedProjectListItem) => {
    setTrashActionError("");
    try {
      await restoreProjectApi(item.id);
      setDeletedProjects((prev) => prev.filter((p) => p.id !== item.id));
      const list = await listProjectsApi();
      const PROJECT_COLORS = ["#e05297", "#7c5cff", "#ff5454", "#14f195", "#00d2ff", "#ffaa00", "#ff00ff", "#a3ff00"];
      setProjects(list.map((p, i) => ({
        id: p.id, name: p.name, bpm: p.bpm, key: "—",
        tracks: p.trackCount,
        updatedAt: new Date(p.updatedAt).toLocaleDateString(),
        updatedAtRaw: p.updatedAt as string,
        color: PROJECT_COLORS[i % PROJECT_COLORS.length] as string,
        published: p.published ?? false,
      })));
    } catch { setTrashActionError("Failed to restore project."); }
  };

  const submitPermDelete = async () => {
    const target = permDeleteTarget();
    if (!target) return;
    setPermDeleteLoading(true);
    setTrashActionError("");
    try {
      await permanentlyDeleteProjectApi(target.id);
      setDeletedProjects((prev) => prev.filter((p) => p.id !== target.id));
      setPermDeleteTarget(null);
    } catch { setTrashActionError("Failed to permanently delete project."); }
    finally { setPermDeleteLoading(false); }
  };

  const daysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // ── Tab switching ──────────────────────────────────────────────────
  const switchTab = (t: Tab) => {
    setTab(t);
    // rAF defers GSAP until SolidJS has committed the new tab's DOM so the selector finds real elements
    requestAnimationFrame(() => {
      gsap.fromTo(".db__content", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out" });
    });
  };

  // ── Account delete handlers ────────────────────────────────────────
  const handleStartDelete = () => setDeleteStep("confirm");
  const handleConfirmDelete = () => setDeleteStep("password");
  const handleCancelDelete = () => { setDeleteStep("none"); setDeletePassword(""); setDeleteError(""); };

  const handleFinalDelete = async (e: Event) => {
    e.preventDefault();
    if (!deletePassword()) { setDeleteError("Password is required."); return; }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await authClient.deleteUser({ password: deletePassword() });
      if (res.error) throw res.error;
      props.onLogout();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete account. Check your password.");
    } finally { setDeleteLoading(false); }
  };

  return (
    <div ref={(el) => { pageRef = el; }} class="db">

      {/* ── Bar ──────────────────────────────────────────────────── */}
      <header class="db__bar">
        <span class="db__bar-brand">
          <span class="db__bar-brand-word">
            <span class="db__bar-brand-melo">Melo</span>
            <span class="db__bar-brand-studio">Studio</span>
          </span>
        </span>
        <nav class="db__nav">
          <button class={`db__nav-link${tab() === "home" ? " db__nav-link--active" : ""}`} onClick={() => switchTab("home")}>Home</button>
          <button class={`db__nav-link${tab() === "library" ? " db__nav-link--active" : ""}`} onClick={() => switchTab("library")}>Library</button>
          <button class={`db__nav-link${tab() === "profile" ? " db__nav-link--active" : ""}`} onClick={() => switchTab("profile")}>Profile</button>
        </nav>
        <div class="db__bar-right">
          <span class="db__clock">{formatTime()}</span>
          <NotificationsDropdown />
          <button class="db__bar-logout" onClick={handleLogout} title="Log out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      {/* ── Tab content ───────────────────────────────────────────── */}
      <Show when={tab() === "home"}>
        <Feed onOpenProject={props.onOpenProject} />
      </Show>

      <Show when={tab() === "library"}>
        <Library
          projects={projects}
          userImage={() => user()?.image}
          libCat={libCat}
          setLibCat={setLibCat}
          libSearch={libSearch}
          setLibSearch={setLibSearch}
          tabRefs={tabRefs}
          tabInd={tabInd}
          menuProjectId={menuProjectId}
          toggleMenu={toggleMenu}
          closeMenu={closeMenu}
          deletedProjects={deletedProjects}
          deletedLoading={deletedLoading}
          trashActionError={trashActionError}
          setTrashActionError={setTrashActionError}
          loadDeletedProjects={loadDeletedProjects}
          handleRestore={handleRestore}
          setPermDeleteTarget={setPermDeleteTarget}
          daysLeft={daysLeft}
          openCreate={openCreate}
          openRename={openRename}
          openDelete={openDelete}
          onOpenProject={props.onOpenProject}
        />
      </Show>

      <Show when={tab() === "profile"}>
        <Profile
          user={user}
          initials={initials}
          handleImageUpload={handleImageUpload}
          followCounts={followCounts}
          projects={projects}
          totalTracks={totalTracks}
          fmtStudioTime={fmtStudioTime}
          onOpenProject={props.onOpenProject}
        />
      </Show>

      {/* ── Account delete modal ──────────────────────────────────── */}
      <Show when={deleteStep() !== "none"}>
        <div class="db__modal-overlay" onClick={handleCancelDelete}>
          <div class="db__modal" onClick={(e) => e.stopPropagation()}>
            <Show when={deleteStep() === "confirm"}>
              <h3 class="db__modal-title">Are you sure?</h3>
              <p class="db__modal-desc">This will permanently delete your account and all associated data. This action cannot be undone.</p>
              <div class="db__modal-btns">
                <button class="db__btn db__btn--danger" onClick={handleConfirmDelete}>Yes, delete</button>
                <button class="db__btn db__btn--ghost" onClick={handleCancelDelete}>No, go back</button>
              </div>
            </Show>
            <Show when={deleteStep() === "password"}>
              <h3 class="db__modal-title">Confirm your password</h3>
              <p class="db__modal-desc">Enter your password to permanently delete your account.</p>
              <form onSubmit={handleFinalDelete}>
                <div class="db__frow">
                  <input class="db__finput" type="password" placeholder="Password" value={deletePassword()} onInput={(e) => setDeletePassword(e.currentTarget.value)} required />
                  <div class="db__fline" />
                </div>
                <Show when={deleteError()}>
                  <span class="db__form-err">{deleteError()}</span>
                </Show>
                <div class="db__modal-btns">
                  <button class="db__btn db__btn--danger" type="submit" disabled={deleteLoading()}>
                    {deleteLoading() ? "Deleting..." : "Delete Account"}
                  </button>
                  <button class="db__btn db__btn--ghost" type="button" onClick={handleCancelDelete}>Cancel</button>
                </div>
              </form>
            </Show>
          </div>
        </div>
      </Show>

      {/* ── Create project modal ──────────────────────────────────── */}
      <Show when={createOpen()}>
        <div class="db__pm-overlay" onClick={() => setCreateOpen(false)}>
          <form class="db__pm" onClick={(e) => e.stopPropagation()} onSubmit={submitCreate}>
            <div class="db__pm-meta">
              <span>New session</span>
              <span class="db__pm-sep">/</span>
              <span><strong>{projects().length + 1}</strong> total</span>
              <span class="db__pm-sep">/</span>
              <span>{new Date().getFullYear()}</span>
            </div>
            <div class="db__pm-display">
              <span class="db__pm-line db__pm-line--pink">Name</span>
              <span class="db__pm-line db__pm-line--stroke">it.</span>
            </div>
            <input class="db__pm-input" autofocus value={createName()} onInput={(e) => setCreateName(e.currentTarget.value)} placeholder="Untitled project" />
            <Show when={projectActionError()}><span class="db__pm-error">{projectActionError()}</span></Show>
            <div class="db__pm-row">
              <button type="submit" class="db__pm-btn db__pm-btn--primary">Create</button>
              <button type="button" class="db__pm-btn db__pm-btn--ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      </Show>

      {/* ── Rename project modal ──────────────────────────────────── */}
      <Show when={renameTarget()}>
        <div class="db__pm-overlay" onClick={() => setRenameTarget(null)}>
          <form class="db__pm" onClick={(e) => e.stopPropagation()} onSubmit={submitRename}>
            <div class="db__pm-meta">
              <span>Rename</span>
              <span class="db__pm-sep">/</span>
              <span>{renameTarget()?.bpm || 100} BPM</span>
              <span class="db__pm-sep">/</span>
              <span>{renameTarget()?.updatedAt}</span>
            </div>
            <div class="db__pm-display">
              <span class="db__pm-line db__pm-line--pink">Re</span>
              <span class="db__pm-line db__pm-line--stroke">name.</span>
            </div>
            <input class="db__pm-input" autofocus value={renameValue()} onInput={(e) => setRenameValue(e.currentTarget.value)} placeholder={renameTarget()?.name} />
            <Show when={projectActionError()}><span class="db__pm-error">{projectActionError()}</span></Show>
            <div class="db__pm-row">
              <button type="submit" class="db__pm-btn db__pm-btn--primary" disabled={projectActionLoading()}>{projectActionLoading() ? "Saving" : "Save"}</button>
              <button type="button" class="db__pm-btn db__pm-btn--ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
            </div>
          </form>
        </div>
      </Show>

      {/* ── Delete project modal ──────────────────────────────────── */}
      <Show when={deleteTarget()}>
        <div class="db__pm-overlay" onClick={() => setDeleteTarget(null)}>
          <div class="db__pm" onClick={(e) => e.stopPropagation()}>
            <div class="db__pm-meta">
              <span>Delete</span>
              <span class="db__pm-sep">/</span>
              <span>{deleteTarget()?.name}</span>
              <span class="db__pm-sep">/</span>
              <span>Permanent</span>
            </div>
            <div class="db__pm-display">
              <span class="db__pm-line db__pm-line--danger">Sure?</span>
              <span class="db__pm-line db__pm-line--stroke">No undo.</span>
            </div>
            <Show when={projectActionError()}><span class="db__pm-error">{projectActionError()}</span></Show>
            <div class="db__pm-row">
              <button type="button" class="db__pm-btn db__pm-btn--danger" disabled={projectActionLoading()} onClick={submitDelete}>{projectActionLoading() ? "Moving to trash..." : "Move to Trash"}</button>
              <button type="button" class="db__pm-btn db__pm-btn--ghost" onClick={() => setDeleteTarget(null)}>Keep it</button>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Permanent delete modal ────────────────────────────────── */}
      <Show when={permDeleteTarget()}>
        <div class="db__pm-overlay" onClick={() => setPermDeleteTarget(null)}>
          <div class="db__pm" onClick={(e) => e.stopPropagation()}>
            <div class="db__pm-meta">
              <span>Delete Forever</span>
              <span class="db__pm-sep">/</span>
              <span>{permDeleteTarget()?.name}</span>
              <span class="db__pm-sep">/</span>
              <span>Cannot undo</span>
            </div>
            <div class="db__pm-display">
              <span class="db__pm-line db__pm-line--danger">Gone.</span>
              <span class="db__pm-line db__pm-line--stroke">No recovery.</span>
            </div>
            <Show when={trashActionError()}><span class="db__pm-error">{trashActionError()}</span></Show>
            <div class="db__pm-row">
              <button type="button" class="db__pm-btn db__pm-btn--danger" disabled={permDeleteLoading()} onClick={submitPermDelete}>{permDeleteLoading() ? "Deleting..." : "Yes, Delete Forever"}</button>
              <button type="button" class="db__pm-btn db__pm-btn--ghost" onClick={() => setPermDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Mobile bottom nav ─────────────────────────────────────── */}
      <nav class="db__mobile-nav">
        <button class={`db__mobile-nav-btn${tab() === "home" ? " db__mobile-nav-btn--active" : ""}`} onClick={() => switchTab("home")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>
          <span>Home</span>
        </button>
        <button class={`db__mobile-nav-btn${tab() === "library" ? " db__mobile-nav-btn--active" : ""}`} onClick={() => switchTab("library")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14M4 19a2 2 0 01-2-2V7h4M4 19h16M8 9h8M8 13h5"/></svg>
          <span>Library</span>
        </button>
        <button class={`db__mobile-nav-btn${tab() === "profile" ? " db__mobile-nav-btn--active" : ""}`} onClick={() => switchTab("profile")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>
          <span>Profile</span>
        </button>
      </nav>

    </div>
  );
};

export default Dashboard;
