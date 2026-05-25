import { type Component, createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { gsap } from "gsap";
import { authClient } from "../../lib/auth";
import { socialAuthClient } from "../../lib/social-auth";
import { listProjectsApi, deleteProjectApi, updateProjectApi, getProjectStatsApi, listDeletedProjectsApi, restoreProjectApi, permanentlyDeleteProjectApi, type DeletedProjectListItem } from "../../lib/api";
import "./dashboard.scss";

interface Project {
  id: string;
  name: string;
  bpm: number;
  key: string;
  tracks: number;
  updatedAt: string;
  color: string;
}

type Tab = "overview" | "profile" | "library";

const Dashboard: Component<{
  onLogout: () => void;
  onNewProject: (name?: string) => void;
  onOpenProject: (id: string) => void;
  onHome: () => void;
}> = (props) => {
  let pageRef!: HTMLDivElement;

  const [user, setUser] = createSignal<{
    name?: string;
    email?: string;
    image?: string;
    createdAt?: string;
  } | null>(null);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = createSignal(true);
  const [time, setTime] = createSignal(new Date());
  const [tab, setTab] = createSignal<Tab>("overview");
  const [studioHours, setStudioHours] = createSignal(0);

  // Profile form
  const [profileName, setProfileName] = createSignal("");
  const [profileBio, setProfileBio] = createSignal("");
  const [profileInstagram, setProfileInstagram] = createSignal("");
  const [profileTwitter, setProfileTwitter] = createSignal("");
  const [profileWebsite, setProfileWebsite] = createSignal("");
  const [profileSaving, setProfileSaving] = createSignal(false);
  const [profileSaved, setProfileSaved] = createSignal(false);

  // Password change
  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [passwordError, setPasswordError] = createSignal("");
  const [passwordSaved, setPasswordSaved] = createSignal(false);

  // Delete
  // Library
  const [libCat, setLibCat] = createSignal<"all" | "mine" | "liked" | "deleted">("all");
  const [libSearch, setLibSearch] = createSignal("");

  const [deleteStep, setDeleteStep] = createSignal<"none" | "confirm" | "password">("none");
  const [deletePassword, setDeletePassword] = createSignal("");
  const [deleteLoading, setDeleteLoading] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");

  onMount(async () => {
    try {
      // If a Better Auth (Twitter) session is active, prefer it and clear any
      // stale Neon Auth session so the wrong user is never shown.
      const socialSession = await socialAuthClient.getSession();
      if (socialSession.data?.user) {
        try { await (authClient as any).signOut(); } catch {}
      }
      let userData = socialSession.data?.user;
      if (!userData) userData = (await authClient.getSession()).data?.user;
      if (userData) {
        setUser({
          name: userData.name,
          email: userData.email,
          image: userData.image ?? undefined,
          createdAt: typeof userData.createdAt === "string" ? userData.createdAt : (userData.createdAt as any)?.toISOString?.() ?? undefined,
        });
        setProfileName(userData.name ?? "");
      }
    } catch {}
  });

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

  onMount(async () => {
    try {
      const list = await listProjectsApi();
      const PROJECT_COLORS = ["#e05297", "#7c5cff", "#ff5454", "#14f195", "#00d2ff", "#ffaa00", "#ff00ff", "#a3ff00"];
      setProjects(
        list.map((p, i) => ({
          id: p.id,
          name: p.name,
          bpm: p.bpm,
          key: "—",
          tracks: p.trackCount,
          updatedAt: new Date(p.updatedAt).toLocaleDateString(),
          color: PROJECT_COLORS[i % PROJECT_COLORS.length] as string,
        })),
      );
      const stats = await getProjectStatsApi();
      setStudioHours(stats.studioHours);
    } catch {
      // silently ignore — user may not be signed in yet
    } finally {
      setLoadingProjects(false);
    }
  });

  const handleLogout = async () => {
    try { await authClient.signOut(); } catch {}
    props.onLogout();
  };

  const handleImageUpload = (e: Event & { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const result = evt.target?.result as string;
        try {
          await authClient.updateUser({ image: result });
          setUser((u) => (u ? { ...u, image: result } : u));
        } catch (err) {
          setUser((u) => (u ? { ...u, image: result } : u));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await authClient.updateUser({ name: profileName() });
      setUser((u) => u ? { ...u, name: profileName() } : u);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch {}
    setProfileSaving(false);
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSaved(false);
    if (newPassword().length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    try {
      await authClient.changePassword({
        currentPassword: currentPassword(),
        newPassword: newPassword(),
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch {
      setPasswordError("Failed to change password. Check your current password.");
    }
  };

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

  const memberSince = () => {
    const d = user()?.createdAt;
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const totalTracks = () => projects().reduce((a, p) => a + p.tracks, 0);

  const fmtStudioTime = () => {
    const h = studioHours();
    if (h <= 0) return "0m";
    if (h < 1) return `${Math.round(h * 60)}m`;
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  // Project modals
  const [createOpen, setCreateOpen] = createSignal(false);
  const [createName, setCreateName] = createSignal("New Project");
  const [renameTarget, setRenameTarget] = createSignal<Project | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [deleteTarget, setDeleteTarget] = createSignal<Project | null>(null);
  const [projectActionError, setProjectActionError] = createSignal("");
  const [projectActionLoading, setProjectActionLoading] = createSignal(false);

  // Row context menu
  const [menuProjectId, setMenuProjectId] = createSignal<string | null>(null);
  const closeMenu = () => setMenuProjectId(null);
  const toggleMenu = (e: Event, id: string) => {
    e.stopPropagation();
    setMenuProjectId((prev) => (prev === id ? null : id));
  };

  // Deleted / trash tab
  const [deletedProjects, setDeletedProjects] = createSignal<DeletedProjectListItem[]>([]);
  const [deletedLoading, setDeletedLoading] = createSignal(false);
  const [permDeleteTarget, setPermDeleteTarget] = createSignal<DeletedProjectListItem | null>(null);
  const [permDeleteLoading, setPermDeleteLoading] = createSignal(false);
  const [trashActionError, setTrashActionError] = createSignal("");

  const loadDeletedProjects = async () => {
    setDeletedLoading(true);
    try {
      setDeletedProjects(await listDeletedProjectsApi());
    } catch {
      // silently ignore
    } finally {
      setDeletedLoading(false);
    }
  };

  const handleRestore = async (item: DeletedProjectListItem) => {
    setTrashActionError("");
    try {
      await restoreProjectApi(item.id);
      setDeletedProjects((prev) => prev.filter((p) => p.id !== item.id));
      // Reload active projects so the restored one appears
      const list = await listProjectsApi();
      const PROJECT_COLORS = ["#e05297", "#7c5cff", "#ff5454", "#14f195", "#00d2ff", "#ffaa00", "#ff00ff", "#a3ff00"];
      setProjects(list.map((p, i) => ({ id: p.id, name: p.name, bpm: p.bpm, key: "—", tracks: p.trackCount, updatedAt: new Date(p.updatedAt).toLocaleDateString(), color: PROJECT_COLORS[i % PROJECT_COLORS.length] as string })));
    } catch {
      setTrashActionError("Failed to restore project.");
    }
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
    } catch {
      setTrashActionError("Failed to permanently delete project.");
    } finally {
      setPermDeleteLoading(false);
    }
  };

  const daysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const openCreate = () => {
    setCreateName("New Project");
    setProjectActionError("");
    setCreateOpen(true);
  };

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
    } catch {
      setProjectActionError("Failed to rename project.");
    } finally {
      setProjectActionLoading(false);
    }
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
    } catch {
      setProjectActionError("Failed to delete project.");
    } finally {
      setProjectActionLoading(false);
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    requestAnimationFrame(() => {
      gsap.fromTo(".db__content", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out" });
    });
  };

  const handleStartDelete = () => setDeleteStep("confirm");
  const handleConfirmDelete = () => setDeleteStep("password");
  const handleCancelDelete = () => {
    setDeleteStep("none");
    setDeletePassword("");
    setDeleteError("");
  };

  const handleFinalDelete = async (e: Event) => {
    e.preventDefault();
    if (!deletePassword()) {
      setDeleteError("Password is required.");
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await authClient.deleteUser({ password: deletePassword() });
      if (res.error) throw res.error;
      props.onLogout();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete account. Check your password.");
    } finally {
      setDeleteLoading(false);
    }
  };

  onMount(() => {
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo(pageRef, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    tl.fromTo(".db__bar", { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.1);
    tl.fromTo(".db__hero-char", { y: "140%", opacity: 0, rotateZ: 6 }, { y: "0%", opacity: 1, rotateZ: 0, duration: 1.1, stagger: 0.02 }, 0.15);
    tl.fromTo(".db__hero-script", { opacity: 0, y: 60, filter: "blur(12px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.3 }, 0.3);
    tl.fromTo(".db__hero-avatar", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 1.2, ease: "back.out(1.5)" }, 0.4);
    tl.fromTo(".db__hero-meta > *", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05 }, 0.5);
    tl.fromTo(".db__rule", { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "power3.inOut", stagger: 0.08 }, 0.5);
    tl.fromTo(".db__stat", { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06 }, 0.7);
    tl.fromTo(".db__section", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.15 }, 0.85);
  });

  return (
    <div ref={pageRef!} class="db">

      {/* Bar */}
      <header class="db__bar">
        <div class="db__bar-left">
          <button class="db__home-btn" onClick={props.onHome} title="Back to home">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button class="db__logo" onClick={props.onHome}>
            <span class="db__logo-melo">MELO</span>
            <span class="db__logo-studio">Studio</span>
          </button>
        </div>
        <nav class="db__nav">
          <button class={`db__nav-link${tab() === "overview" ? " db__nav-link--active" : ""}`} onClick={() => switchTab("overview")}>Overview</button>
          <button class={`db__nav-link${tab() === "library" ? " db__nav-link--active" : ""}`} onClick={() => switchTab("library")}>Library</button>
          <button class={`db__nav-link${tab() === "profile" ? " db__nav-link--active" : ""}`} onClick={() => switchTab("profile")}>Profile</button>
        </nav>
        <div class="db__bar-right">
          <span class="db__clock">{formatTime()}</span>
          <button class="db__bar-avatar" onClick={() => switchTab("profile")}>
            <Show when={user()?.image} fallback={<span class="db__bar-avatar-initials">{initials()}</span>}>
              <img src={user()!.image!} alt="" />
            </Show>
          </button>
          <button class="db__bar-logout" onClick={handleLogout}>
            <span>Log out</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      <Show when={tab() === "overview"}>
        <div class="db__content">

          <section class="db__hero">
            <div class="db__hero-left">
              <div class="db__hero-greeting">
                <span class="db__hero-script">{greeting()},</span>
              </div>
              <div class="db__hero-clip">
                <For each={firstName().split("")}>
                  {(ch) => <span class="db__hero-char">{ch === " " ? "\u00A0" : ch}</span>}
                </For>
              </div>
              <div class="db__hero-meta">
                <span class="db__hero-meta-item">{projects().length} Projects</span>
                <span class="db__hero-meta-sep">/</span>
                <span class="db__hero-meta-item">{totalTracks()} Tracks</span>
                <span class="db__hero-meta-sep">/</span>
                <span class="db__hero-meta-item">Since {memberSince()}</span>
              </div>
            </div>
            <button class="db__hero-avatar" onClick={() => switchTab("profile")}>
              <Show when={user()?.image} fallback={<span class="db__hero-avatar-text">{initials()}</span>}>
                <img class="db__hero-avatar-img" src={user()!.image!} alt="" />
              </Show>
            </button>
          </section>

          <div class="db__rule" />

          <section class="db__stats">
            <div class="db__stat">
              <span class="db__stat-num">{projects().length}</span>
              <span class="db__stat-label">Projects</span>
              <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: `${Math.min(projects().length * 10, 100)}%` }} /></span>
            </div>

            <div class="db__stat">
              <span class="db__stat-num">{totalTracks()}</span>
              <span class="db__stat-label">Tracks</span>
              <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: `${Math.min(totalTracks() * 5, 100)}%` }} /></span>
            </div>

            <div class="db__stat">
              <span class="db__stat-num">{fmtStudioTime()}</span>
              <span class="db__stat-label">Studio Time</span>
              <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: `${Math.min(studioHours() * 10, 100)}%` }} /></span>
            </div>

            <div class="db__stat">
              <span class="db__stat-num">0</span>
              <span class="db__stat-label">Templates</span>
              <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: `0%` }} /></span>
            </div>
          </section>

          <div class="db__rule" />

          <section class="db__section">
            <div class="db__section-header">
              <span class="db__section-idx">01</span>
              <h2 class="db__section-title">Projects</h2>
              <button class="db__section-action" onClick={openCreate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4v16m8-8H4" /></svg>
                New project
              </button>
            </div>
            <Show when={!loadingProjects()} fallback={
              <div class="db__skeletons">
                {[1,2,3].map(() => <div class="db__skeleton-row" />)}
              </div>
            }>
              <Show when={projects().length > 0} fallback={
                <div class="db__empty">
                  <div class="db__empty-glow" />
                  <span class="db__empty-note">♪</span>
                  <h3 class="db__empty-title">Nothing here yet</h3>
                  <p class="db__empty-sub">Create your first project and start making music.</p>
                  <button class="db__empty-cta" onClick={openCreate}>
                    <span>Start creating</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
                  </button>
                </div>
              }>
              <div class="db__table">
                <div class="db__table-head">
                  <span class="db__th db__th--num">#</span>
                  <span class="db__th db__th--name">Name</span>
                  <span class="db__th db__th--bpm">BPM</span>
                  <span class="db__th db__th--key">Key</span>
                  <span class="db__th db__th--tracks">Tracks</span>
                  <span class="db__th db__th--time">Modified</span>
                  <span class="db__th db__th--acts" />
                </div>
                <For each={projects()}>{(project, i) =>
                  <div class="db__table-row" onClick={() => props.onOpenProject(project.id)}>
                    <span class="db__td db__td--num">{String(i() + 1).padStart(2, "0")}</span>
                    <span class="db__td db__td--name">
                      <span class="db__td-dot" style={{ background: project.color }} />
                      {project.name}
                    </span>
                    <span class="db__td db__td--bpm">{project.bpm || 100}</span>
                    <span class="db__td db__td--key">{project.key}</span>
                    <span class="db__td db__td--tracks">{project.tracks || 1}</span>
                    <span class="db__td db__td--time">{project.updatedAt}</span>
                    <span class="db__td db__td--acts">
                      <button class="db__act-btn" onClick={(e) => openRename(e, project)} title="Rename">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2l5 5-9 9H2v-5z" /></svg>
                      </button>
                      <button class="db__act-btn db__act-btn--danger" onClick={(e) => openDelete(e, project)} title="Delete">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5 4V2h6v2M6 8v5M10 8v5M3 4l1 10h8l1-10" /></svg>
                      </button>
                    </span>
                  </div>
                }</For>
              </div>
            </Show>
            </Show>
          </section>

          <div class="db__rule" />

          <section class="db__section">
            <div class="db__section-header">
              <span class="db__section-idx">02</span>
              <h2 class="db__section-title">Quick Actions</h2>
            </div>
            <div class="db__actions">
              <button class="db__act">
                <div class="db__act-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </div>
                <div class="db__act-body">
                  <span class="db__act-label">Import Audio</span>
                  <span class="db__act-desc">Drag in stems, samples, or full tracks</span>
                </div>
                <svg class="db__act-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
              <button class="db__act">
                <div class="db__act-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>
                </div>
                <div class="db__act-body">
                  <span class="db__act-label">Browse Templates</span>
                  <span class="db__act-desc">Pick a genre template and build on it</span>
                </div>
                <svg class="db__act-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
              <button class="db__act" onClick={() => switchTab("profile")}>
                <div class="db__act-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div class="db__act-body">
                  <span class="db__act-label">Edit Profile</span>
                  <span class="db__act-desc">Update your name, socials & bio</span>
                </div>
                <svg class="db__act-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
            </div>
          </section>

          <footer class="db__brand">
            <span class="db__brand-melo">Melo</span>
            <span class="db__brand-studio">Studio</span>
          </footer>
        </div>
      </Show>

      <Show when={tab() === "profile"}>
        <div class="db__content db__content--profile">

          {/* ── Ticket identity card ── */}
          <div class="db__ticket">
            <div class="db__ticket-stripe">
              <span class="db__ticket-stripe-text">ADMIT ONE</span>
            </div>
            <div class="db__ticket-main">
              <div class="db__ticket-toprow">
                <span class="db__ticket-logo">MELO STUDIO</span>
                <span class="db__ticket-season">Artist Pass · Season 2026</span>
              </div>
              <div class="db__ticket-head">
                <div class="db__ticket-event">
                  <h1 class="db__ticket-name">{(user()?.name ?? "Artist").toUpperCase()}</h1>
                  <span class="db__ticket-email">{user()?.email}</span>
                  <div class="db__ticket-tags">
                    <span class="db__ticket-tag">Producer</span>
                    <span class="db__ticket-tag">Free Tier</span>
                    <span class="db__ticket-tag db__ticket-tag--live">
                      <span class="db__ticket-tag-dot" />
                      Active
                    </span>
                  </div>
                </div>
                <div class="db__ticket-photo-wrap">
                  <input type="file" accept="image/*" onChange={handleImageUpload} class="db__profile-upload-input" title="Change profile picture" />
                  <div class="db__ticket-photo">
                    <Show when={user()?.image} fallback={<span class="db__profile-initials">{initials()}</span>}>
                      <img class="db__profile-img" src={user()!.image!} alt="" />
                    </Show>
                    <div class="db__ticket-photo-overlay">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3H7L5 7H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2-4z"/><circle cx="10" cy="12" r="3"/></svg>
                    </div>
                  </div>
                  <span class="db__ticket-photo-label">Artist</span>
                </div>
              </div>
              <div class="db__ticket-perf" />
              <div class="db__ticket-body">
                <div class="db__ticket-field">
                  <span class="db__ticket-field-label">Member Since</span>
                  <span class="db__ticket-field-val">{memberSince()}</span>
                </div>
                <div class="db__ticket-vdivider" />
                <div class="db__ticket-field">
                  <span class="db__ticket-field-label">Projects</span>
                  <span class="db__ticket-field-val">{projects().length}</span>
                </div>
                <div class="db__ticket-vdivider" />
                <div class="db__ticket-field">
                  <span class="db__ticket-field-label">Tracks</span>
                  <span class="db__ticket-field-val">{totalTracks()}</span>
                </div>
                <div class="db__ticket-vdivider" />
                <div class="db__ticket-field">
                  <span class="db__ticket-field-label">Studio Time</span>
                  <span class="db__ticket-field-val">{fmtStudioTime()}</span>
                </div>
                <div class="db__ticket-vdivider" />
                <div class="db__ticket-field">
                  <span class="db__ticket-field-label">Venue</span>
                  <span class="db__ticket-field-val">Web</span>
                </div>
                <div class="db__ticket-barcode" aria-hidden="true">
                  <div class="db__ticket-bars" />
                  <span class="db__ticket-barcode-num">MS · {memberSince()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Two-column form grid ── */}
          <div class="db__pgrid">

            {/* Left: Edit Profile */}
            <div class="db__pcard db__pcard--form">
              <div class="db__pcard-header">
                <span class="db__pcard-idx">01</span>
                <h2 class="db__pcard-title">Edit Profile</h2>
              </div>
              <div class="db__pfields">

                <div class="db__pfield">
                  <label class="db__pfield-label">Display Name</label>
                  <input class="db__pfield-input" type="text" value={profileName()} onInput={(e) => setProfileName(e.currentTarget.value)} placeholder="Your name" />
                </div>

                <div class="db__pfield db__pfield--locked">
                  <label class="db__pfield-label">
                    Email
                    <span class="db__pfield-lock">
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5.5" width="8" height="5.5" rx="1"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/></svg>
                      managed
                    </span>
                  </label>
                  <input class="db__pfield-input" type="email" value={user()?.email ?? ""} disabled />
                </div>

                <div class="db__pfield">
                  <label class="db__pfield-label">Bio</label>
                  <textarea class="db__pfield-textarea" value={profileBio()} onInput={(e) => setProfileBio(e.currentTarget.value)} placeholder="Tell the world about yourself..." rows={3} />
                </div>

                <div class="db__pfield">
                  <label class="db__pfield-label">Website</label>
                  <div class="db__pfield-pre">
                    <span class="db__pfield-pre-icon">
                      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="5.5"/><path d="M1.5 7h11M7 1.5c-1.5 2-2 3.5-2 5.5s.5 3.5 2 5.5M7 1.5c1.5 2 2 3.5 2 5.5s-.5 3.5-2 5.5"/></svg>
                    </span>
                    <input class="db__pfield-input" type="url" value={profileWebsite()} onInput={(e) => setProfileWebsite(e.currentTarget.value)} placeholder="https://yoursite.com" />
                  </div>
                </div>

                <div class="db__pfield-pair">
                  <div class="db__pfield">
                    <label class="db__pfield-label">Instagram</label>
                    <div class="db__pfield-pre">
                      <span class="db__pfield-pre-at">@</span>
                      <input class="db__pfield-input" type="text" value={profileInstagram()} onInput={(e) => setProfileInstagram(e.currentTarget.value)} placeholder="username" />
                    </div>
                  </div>
                  <div class="db__pfield">
                    <label class="db__pfield-label">Twitter / X</label>
                    <div class="db__pfield-pre">
                      <span class="db__pfield-pre-at">@</span>
                      <input class="db__pfield-input" type="text" value={profileTwitter()} onInput={(e) => setProfileTwitter(e.currentTarget.value)} placeholder="handle" />
                    </div>
                  </div>
                </div>

              </div>
              <div class="db__pcard-actions">
                <button class="db__btn db__btn--fill" onClick={handleSaveProfile} disabled={profileSaving()}>
                  {profileSaving() ? "Saving..." : profileSaved() ? "Saved ✓" : "Save Changes"}
                </button>
                <button class="db__btn db__btn--ghost" onClick={() => { setProfileName(user()?.name ?? ""); setProfileBio(""); setProfileInstagram(""); setProfileTwitter(""); setProfileWebsite(""); }}>
                  Reset
                </button>
              </div>
            </div>

            {/* Right: Password + Danger */}
            <div class="db__pstack">

              <div class="db__pcard db__pcard--form">
                <div class="db__pcard-header">
                  <span class="db__pcard-idx">02</span>
                  <h2 class="db__pcard-title">Change Password</h2>
                </div>
                <div class="db__pfields">
                  <div class="db__pfield">
                    <label class="db__pfield-label">Current Password</label>
                    <input class="db__pfield-input" type="password" value={currentPassword()} onInput={(e) => setCurrentPassword(e.currentTarget.value)} placeholder="••••••••" />
                  </div>
                  <div class="db__pfield">
                    <label class="db__pfield-label">New Password</label>
                    <input class="db__pfield-input" type="password" value={newPassword()} onInput={(e) => setNewPassword(e.currentTarget.value)} placeholder="Min 8 characters" />
                  </div>
                </div>
                <Show when={passwordError()}>
                  <span class="db__form-err">{passwordError()}</span>
                </Show>
                <div class="db__pcard-actions">
                  <button class="db__btn db__btn--ghost" onClick={handleChangePassword}>
                    {passwordSaved() ? "Updated ✓" : "Update Password"}
                  </button>
                </div>
              </div>

              <div class="db__pcard db__pcard--danger">
                <div class="db__pcard-header">
                  <span class="db__pcard-idx db__pcard-idx--danger">03</span>
                  <h2 class="db__pcard-title">Danger Zone</h2>
                </div>
                <p class="db__pcard-danger-sub">Permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.</p>
                <div class="db__pcard-actions">
                  <button class="db__btn db__btn--danger" onClick={handleStartDelete}>Delete Account</button>
                </div>
              </div>

            </div>
          </div>

          <footer class="db__brand">
            <span class="db__brand-melo">Melo</span>
            <span class="db__brand-studio">Studio</span>
          </footer>
        </div>
      </Show>

      <Show when={tab() === "library"}>
        <div class="db__content db__content--library">

            {/* ── Sidebar ── */}
          <aside class="db__lib-sidebar">
            <nav class="db__lib-sidenav">
              <button class={`db__lib-sidelink${libCat() === "all" ? " db__lib-sidelink--active" : ""}`} onClick={() => setLibCat("all")}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
                All Projects
              </button>
              <button class={`db__lib-sidelink${libCat() === "mine" ? " db__lib-sidelink--active" : ""}`} onClick={() => setLibCat("mine")}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10" cy="7" r="3.5" /><path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6" /></svg>
                My Projects
              </button>
              <button class={`db__lib-sidelink${libCat() === "liked" ? " db__lib-sidelink--active" : ""}`} onClick={() => setLibCat("liked")}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 16s-7-4.3-7-8.5A4.5 4.5 0 0 1 10 5a4.5 4.5 0 0 1 7 2.5C17 11.7 10 16 10 16z" /></svg>
                Liked Projects
              </button>
              <div class="db__lib-side-divider" />
              <button class={`db__lib-sidelink${libCat() === "deleted" ? " db__lib-sidelink--active" : ""}`} onClick={() => { setLibCat("deleted"); loadDeletedProjects(); }}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 6h12M7 6V4h6v2M8 9v6m4-6v6M5 6l1 10h8l1-10" /></svg>
                Deleted Projects
              </button>
            </nav>
          </aside>

          {/* ── Main ── */}
          <div class="db__lib-main">
            <div class="db__lib-topbar">
              <div class="db__lib-topbar-left">
                <h1 class="db__lib-main-title">
                  {libCat() === "all" ? "All Projects" : libCat() === "mine" ? "My Projects" : libCat() === "liked" ? "Liked Projects" : "Deleted Projects"}
                </h1>
                <Show when={libCat() === "all" || libCat() === "mine"}>
                  <span class="db__lib-main-count">{projects().filter(p => p.name.toLowerCase().includes(libSearch().toLowerCase())).length} projects</span>
                </Show>
              </div>
              <div class="db__lib-topbar-right">
                <div class="db__lib-search">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 3 3" /></svg>
                  <input class="db__lib-search-input" type="text" placeholder="Search projects..." value={libSearch()} onInput={(e) => setLibSearch(e.currentTarget.value)} />
                </div>
                <button class="db__lib-upload-btn" onClick={openCreate}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 4v12M4 10h12" /></svg>
                  New
                </button>
              </div>
            </div>

            <div class="db__lib-list" onClick={() => menuProjectId() && closeMenu()}>
              <Show when={libCat() === "all" || libCat() === "mine"}>
                <Show when={projects().filter(p => p.name.toLowerCase().includes(libSearch().toLowerCase())).length === 0}>
                  <div class="db__lib-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" /></svg>
                    <span>No projects yet</span>
                    <button class="db__lib-empty-cta" onClick={openCreate}>Create your first project</button>
                  </div>
                </Show>
                <For each={projects().filter(p => p.name.toLowerCase().includes(libSearch().toLowerCase()))}>{(project) =>
                  <div class="db__lib-row" style={{ "--proj-color": project.color || "#e05297" } as any} onClick={() => { if (!menuProjectId()) props.onOpenProject(project.id); }}>
                    <div class="db__lib-row-thumb">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" /></svg>
                    </div>
                    <div class="db__lib-row-info">
                      <span class="db__lib-row-name">{project.name}</span>
                      <span class="db__lib-row-meta">{project.bpm || 100} BPM {project.key && project.key !== "—" ? `• ${project.key} ` : ""}• {project.tracks || 1} track{(project.tracks || 1) !== 1 ? "s" : ""}</span>
                    </div>
                    <span class="db__lib-row-date">{project.updatedAt}</span>
                    <div class="db__lib-row-menu-wrap">
                      <button class="db__lib-row-dots" onClick={(e) => toggleMenu(e, project.id)} title="More options">
                        <svg viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/></svg>
                      </button>
                      <Show when={menuProjectId() === project.id}>
                        <div class="db__lib-row-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button class="db__lib-row-dd-item" onClick={() => { closeMenu(); props.onOpenProject(project.id); }}>
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 4a6 6 0 100 12A6 6 0 0010 4zM4 10h12" /></svg>
                            Open
                          </button>
                          <button class="db__lib-row-dd-item" onClick={(e) => { closeMenu(); openRename(e, project); }}>
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 3l4 4-9 9H4v-4z" /></svg>
                            Rename
                          </button>
                          <div class="db__lib-row-dd-sep" />
                          <button class="db__lib-row-dd-item db__lib-row-dd-item--danger" onClick={(e) => { closeMenu(); openDelete(e, project); }}>
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h12M7 6V4h6v2M8 9v6m4-6v6M5 6l.867 10.4A1 1 0 006.86 17.5h6.28a1 1 0 00.993-.9L15 6" /></svg>
                            Delete
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>
                }</For>
              </Show>
              <Show when={libCat() === "liked"}>
                <div class="db__lib-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                  <span>No liked projects yet</span>
                </div>
              </Show>
              <Show when={libCat() === "deleted"}>
                <Show when={deletedLoading()}>
                  <div class="db__lib-empty"><span>Loading trash...</span></div>
                </Show>
                <Show when={!deletedLoading() && deletedProjects().length === 0}>
                  <div class="db__lib-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                    <span>Trash is empty</span>
                  </div>
                </Show>
                <Show when={!deletedLoading() && deletedProjects().length > 0}>
                  <div class="db__lib-trash-note">
                    Projects are automatically deleted after <strong>10 days</strong> in trash.
                  </div>
                  <For each={deletedProjects()}>{(item) =>
                    <div class="db__lib-row db__lib-row--deleted" style={{ "--proj-color": "#888" } as any}>
                      <div class="db__lib-row-thumb db__lib-row-thumb--deleted">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                      </div>
                      <div class="db__lib-row-info">
                        <span class="db__lib-row-name">{item.name}</span>
                        <span class="db__lib-row-meta">{item.bpm} BPM • {item.trackCount} track{item.trackCount !== 1 ? "s" : ""}</span>
                      </div>
                      <span class="db__lib-row-expiry">{daysLeft(item.expiresAt)}d left</span>
                      <div class="db__lib-row-trash-acts">
                        <button class="db__lib-row-btn" onClick={() => handleRestore(item)}>Restore</button>
                        <button class="db__lib-row-btn db__lib-row-btn--danger" onClick={() => { setPermDeleteTarget(item); setTrashActionError(""); }}>Delete Forever</button>
                      </div>
                    </div>
                  }</For>
                  <Show when={trashActionError()}>
                    <span class="db__lib-trash-err">{trashActionError()}</span>
                  </Show>
                </Show>
              </Show>
            </div>
          </div>

        </div>
      </Show>
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
                  <input
                    class="db__finput"
                    type="password"
                    placeholder="Password"
                    value={deletePassword()}
                    onInput={(e) => setDeletePassword(e.currentTarget.value)}
                    required
                  />
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

      {/* Create project modal */}
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

      {/* Rename project modal */}
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

      {/* Delete project modal */}
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

      {/* Permanent delete confirmation modal */}
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

    </div>
  );
};

export default Dashboard;
