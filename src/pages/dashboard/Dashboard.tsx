import { type Component, createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { gsap } from "gsap";
import { authClient } from "../../lib/auth";
import { socialAuthClient } from "../../lib/social-auth";
import { listProjectsApi, deleteProjectApi, updateProjectApi, getProjectStatsApi } from "../../lib/api";
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

type Tab = "overview" | "profile";

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
  const [deleteStep, setDeleteStep] = createSignal<"none" | "confirm" | "password">("none");
  const [deletePassword, setDeletePassword] = createSignal("");
  const [deleteLoading, setDeleteLoading] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");

  onMount(async () => {
    try {
      let userData = (await authClient.getSession()).data?.user;
      if (!userData) userData = (await socialAuthClient.getSession()).data?.user;
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

          {/* ── Identity card ── */}
          <div class="db__pcard db__pcard--identity">
            <div class="db__pcard-avatar-wrap">
              <input type="file" accept="image/*" onChange={handleImageUpload} class="db__profile-upload-input" title="Change profile picture" />
              <div class="db__pcard-avatar">
                <Show when={user()?.image} fallback={<span class="db__profile-initials">{initials()}</span>}>
                  <img class="db__profile-img" src={user()!.image!} alt="" />
                </Show>
                <div class="db__pcard-avatar-overlay">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3H7L5 7H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2-4z"/><circle cx="10" cy="12" r="3"/></svg>
                  <span>Change</span>
                </div>
              </div>
              <div class="db__pcard-avatar-ring" />
            </div>
            <div class="db__pcard-info">
              <h1 class="db__pcard-name">{user()?.name ?? "—"}</h1>
              <span class="db__pcard-email">{user()?.email}</span>
              <div class="db__pcard-chips">
                <span class="db__chip db__chip--accent">
                  <svg viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="5"/></svg>
                  Since {memberSince()}
                </span>
                <span class="db__chip">{projects().length} projects</span>
                <span class="db__chip">{totalTracks()} tracks</span>
                <span class="db__chip">{fmtStudioTime()} studio time</span>
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

      {/* Delete account modal */}
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
              <button type="button" class="db__pm-btn db__pm-btn--danger" disabled={projectActionLoading()} onClick={submitDelete}>{projectActionLoading() ? "Deleting" : "Delete"}</button>
              <button type="button" class="db__pm-btn db__pm-btn--ghost" onClick={() => setDeleteTarget(null)}>Keep it</button>
            </div>
          </div>
        </div>
      </Show>

    </div>
  );
};

export default Dashboard;
