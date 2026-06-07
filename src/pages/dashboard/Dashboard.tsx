import { type Component, createSignal, createEffect, onMount, onCleanup, For, Show, Index } from "solid-js";

// Deterministic waveform: unique bar heights per project ID
function waveform(seed: string, count = 30): number[] {
  return Array.from({ length: count }, (_, i) => {
    const c = seed.charCodeAt(i % Math.max(seed.length, 1)) || 72;
    return 3 + ((c * 17 + i * 11 + i * i) % 22);
  });
}
import { gsap } from "gsap";
import { authClient } from "../../lib/auth";
import { getAppSession, signOutApp } from "../../lib/app-auth";
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
  let pageRef: HTMLDivElement | undefined;

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
  const tabRefs: Partial<Record<string, HTMLButtonElement>> = {};
  const [tabInd, setTabInd] = createSignal({ left: 0, width: 0, isTrash: false });
  createEffect(() => {
    const cat = libCat();
    requestAnimationFrame(() => {
      const el = tabRefs[cat];
      if (el) setTabInd({ left: el.offsetLeft, width: el.offsetWidth, isTrash: cat === "deleted" });
    });
  });

  const [deleteStep, setDeleteStep] = createSignal<"none" | "confirm" | "password">("none");
  const [deletePassword, setDeletePassword] = createSignal("");
  const [deleteLoading, setDeleteLoading] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");

  onMount(async () => {
    // ── 1. Resolve auth session (must finish BEFORE loading projects so the
    //       right Bearer token / cookie is used for API calls) ──────────────
    try {
      const userData = (await getAppSession())?.user;
      if (userData) {
        // Upgrade Twitter _normal (48px) images to _400x400 for display
        const rawImage = userData.image ?? undefined;
        const image = rawImage?.replace(/_normal(\.[^.]+)$/, "_400x400$1") ?? rawImage;
        setUser({
          name: userData.name,
          email: userData.email,
          image,
          createdAt: typeof userData.createdAt === "string" ? userData.createdAt : (userData.createdAt as any)?.toISOString?.() ?? undefined,
        });
        setProfileName(userData.name ?? "");
      }
    } catch {}

    // ── 2. Now load projects (JWT cleared above if Twitter user) ─────────
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

  const handleLogout = async () => {
    await signOutApp();
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
    if (h < 1) return `${Math.floor(h * 60)}m`;
    const hrs = Math.floor(h);
    const mins = Math.floor((h - hrs) * 60);
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
    if (!pageRef) return;
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo(pageRef, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    tl.fromTo(".db__bar", { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.1);
    tl.fromTo(".db__hero-char", { y: "140%", opacity: 0, rotateZ: 6 }, { y: "0%", opacity: 1, rotateZ: 0, duration: 1.1, stagger: 0.02 }, 0.15);
    tl.fromTo(".db__hero-script", { opacity: 0, y: 60, filter: "blur(12px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.3 }, 0.3);
    tl.fromTo(".db__stat", { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06 }, 0.5);
    tl.fromTo(".db__section", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.15 }, 0.7);
  });

  return (
    <div ref={(el) => { pageRef = el; }} class="db">

      {/* Bar */}
      <header class="db__bar">
        <button class="db__bar-brand" onClick={props.onHome} title="Back to home">
          <svg class="db__bar-brand-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 19l-7-7 7-7" /></svg>
          <span class="db__bar-brand-sep" />
          <span class="db__bar-brand-word">
            <span class="db__bar-brand-melo">Melo</span>
            <span class="db__bar-brand-studio">Studio</span>
          </span>
        </button>
        <nav class="db__nav">
          <button class={`db__nav-link${tab() === "overview" ? " db__nav-link--active" : ""}`} onClick={() => switchTab("overview")}>Overview</button>
          <button class={`db__nav-link${tab() === "library" ? " db__nav-link--active" : ""}`} onClick={() => switchTab("library")}>Library</button>
          <button class={`db__nav-link${tab() === "profile" ? " db__nav-link--active" : ""}`} onClick={() => switchTab("profile")}>Profile</button>
        </nav>
        <div class="db__bar-right">
          <span class="db__clock">{formatTime()}</span>
          <Show when={tab() === "library"}>
            <button class="db__bar-avatar" onClick={() => switchTab("profile")}>
              <Show when={user()?.image} keyed fallback={<span class="db__bar-avatar-initials">{initials()}</span>}>
                {(image) => <img src={image} alt="" />}
              </Show>
            </button>
          </Show>
          <button class="db__bar-logout" onClick={handleLogout} title="Log out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      <Show when={tab() === "overview"}>
        <div class="db__content">

          <section class="db__hero">
            <div class="db__hero-greeting">
              <span class="db__hero-script">{greeting()},</span>
            </div>
            <div class="db__hero-clip">
              <For each={firstName().split("")}>
                {(ch) => <span class="db__hero-char">{ch === " " ? " " : ch}</span>}
              </For>
            </div>
          </section>

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
              <button class="db__section-action" onClick={openCreate} title="New project">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4v16m8-8H4" /></svg>
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
              <div class="db__proj-list">
                <For each={projects()}>{(project) =>
                  <div class="db__proj" style={{ "--pc": project.color } as any} onClick={() => props.onOpenProject(project.id)}>
                    <div class="db__proj-thumb">
                      <span class="db__proj-thumb-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" /></svg>
                      </span>
                    </div>
                    <div class="db__proj-info">
                      <span class="db__proj-name">{project.name}</span>
                      <span class="db__proj-meta">{project.bpm || 100} BPM · {project.tracks || 1} track{(project.tracks || 1) !== 1 ? "s" : ""}</span>
                    </div>
                    <span class="db__proj-date">{project.updatedAt}</span>
                    <div class="db__proj-acts">
                      <button class="db__proj-btn" onClick={(e) => { e.stopPropagation(); openRename(e, project); }} title="Rename">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2l5 5-9 9H2v-5z" /></svg>
                      </button>
                      <button class="db__proj-btn db__proj-btn--danger" onClick={(e) => { e.stopPropagation(); openDelete(e, project); }} title="Delete">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5 4V2h6v2M6 8v5M10 8v5M3 4l1 10h8l1-10" /></svg>
                      </button>
                    </div>
                  </div>
                }</For>
              </div>
            </Show>
            </Show>
          </section>

          {(() => {
            let canvasRef: HTMLCanvasElement | undefined;
            let raf = 0;
            let running = false;
            let mouseX = -1;
            let sized = false;
            const points: number[] = [];
            let pointCount = 0;

            const ensureSize = (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => {
              if (sized) return;
              canvasRef!.width = w * dpr;
              canvasRef!.height = h * dpr;
              ctx.scale(dpr, dpr);
              pointCount = Math.ceil(w / 3);
              points.length = 0;
              for (let i = 0; i < pointCount; i++) points.push(0);
              sized = true;
            };

            const draw = () => {
              if (!canvasRef) return;
              const ctx = canvasRef.getContext("2d")!;
              const rect = canvasRef.getBoundingClientRect();
              const w = rect.width, h = rect.height;
              ensureSize(ctx, w, h, window.devicePixelRatio || 1);

              const mid = h / 2;
              const step = w / pointCount;

              if (mouseX >= 0) {
                const mi = Math.floor(mouseX / step);
                const radius = 18;
                for (let j = -radius; j <= radius; j++) {
                  const idx = mi + j;
                  if (idx < 0 || idx >= pointCount) continue;
                  const dist = Math.abs(j) / radius;
                  const push = (1 - dist * dist) * 12;
                  const dir = j < 0 ? -1 : j > 0 ? 1 : 0;
                  points[idx] += push * (dir * 0.5 + (Math.random() - 0.5) * 0.2);
                }
              }

              let settled = true;
              for (let i = 0; i < pointCount; i++) {
                points[i] *= 0.93;
                if (i > 0) points[i] += (points[i - 1] - points[i]) * 0.22;
                if (i < pointCount - 1) points[i] += (points[i + 1] - points[i]) * 0.22;
                points[i] = Math.max(-30, Math.min(30, points[i]));
                if (Math.abs(points[i]) > 0.05) settled = false;
              }

              ctx.clearRect(0, 0, w, h);

              ctx.beginPath();
              ctx.moveTo(0, mid + points[0]);
              for (let i = 1; i < pointCount; i++) {
                const px = (i - 1) * step;
                const cx = i * step;
                const mx = (px + cx) / 2;
                ctx.quadraticCurveTo(px, mid + points[i - 1], mx, mid + (points[i - 1] + points[i]) / 2);
              }
              ctx.lineTo(w, mid + points[pointCount - 1]);
              ctx.strokeStyle = "rgba(224, 82, 151, 0.4)";
              ctx.lineWidth = 1.5;
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(0, mid + points[0] * 0.4);
              for (let i = 1; i < pointCount; i++) {
                const px = (i - 1) * step;
                const cx = i * step;
                const mx = (px + cx) / 2;
                const py = points[i - 1] * 0.4;
                const ny = points[i] * 0.4;
                ctx.quadraticCurveTo(px, mid + py, mx, mid + (py + ny) / 2);
              }
              ctx.lineTo(w, mid + points[pointCount - 1] * 0.4);
              ctx.strokeStyle = "rgba(224, 82, 151, 0.12)";
              ctx.lineWidth = 1;
              ctx.stroke();

              if (settled && mouseX < 0) {
                ctx.clearRect(0, 0, w, h);
                running = false;
                return;
              }
              raf = requestAnimationFrame(draw);
            };

            const startLoop = () => {
              if (running) return;
              running = true;
              raf = requestAnimationFrame(draw);
            };

            onMount(() => {
              if (!canvasRef) return;
              const ctx = canvasRef.getContext("2d")!;
              const rect = canvasRef.getBoundingClientRect();
              ensureSize(ctx, rect.width, rect.height, window.devicePixelRatio || 1);
            });
            onCleanup(() => cancelAnimationFrame(raf));

            return (
              <canvas
                ref={(el) => { canvasRef = el; }}
                class="db__wave-divider"
                onMouseMove={(e) => {
                  mouseX = e.clientX - canvasRef!.getBoundingClientRect().left;
                  startLoop();
                }}
                onMouseLeave={() => { mouseX = -1; }}
              />
            );
          })()}

          <section class="db__section">
            <div class="db__section-header">
              <span class="db__section-idx">02</span>
              <h2 class="db__section-title">Quick Actions</h2>
            </div>
            <div class="db__qa">
              <button class="db__qa-card" style={{ "--qa-c": "#7c5cff" } as any}>
                <div class="db__qa-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </div>
                <span class="db__qa-label">Import Audio</span>
                <span class="db__qa-desc">Stems, samples, or full tracks</span>
                <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
              <button class="db__qa-card" style={{ "--qa-c": "#e05297" } as any}>
                <div class="db__qa-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>
                </div>
                <span class="db__qa-label">Browse Templates</span>
                <span class="db__qa-desc">Pick a genre and build on it</span>
                <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
              <button class="db__qa-card" style={{ "--qa-c": "#14f195" } as any}>
                <div class="db__qa-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM12 18.5V22M8 22h8" /><circle cx="12" cy="12" r="2.5" /></svg>
                </div>
                <span class="db__qa-label">AI Master</span>
                <span class="db__qa-desc">Auto-master a track in seconds</span>
                <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
              <button class="db__qa-card" style={{ "--qa-c": "#00d2ff" } as any}>
                <div class="db__qa-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
                </div>
                <span class="db__qa-label">Collaborate</span>
                <span class="db__qa-desc">Invite someone to your session</span>
                <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
              <button class="db__qa-card" style={{ "--qa-c": "#ffaa00" } as any}>
                <div class="db__qa-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 0l4-4m0 0l-4-4m4 4H7" /></svg>
                </div>
                <span class="db__qa-label">Export</span>
                <span class="db__qa-desc">WAV, MP3, or stems bundle</span>
                <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
              <button class="db__qa-card" onClick={() => switchTab("profile")} style={{ "--qa-c": "#ff5454" } as any}>
                <div class="db__qa-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                </div>
                <span class="db__qa-label">Settings</span>
                <span class="db__qa-desc">Account, audio prefs, shortcuts</span>
                <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
            </div>
          </section>

        </div>
      </Show>

      <Show when={tab() === "profile"}>
        <div class="db__content db__content--profile">

          <div class="db__pro-header">
            <div class="db__pro-avatar-wrap">
              <input type="file" accept="image/*" onChange={handleImageUpload} class="db__profile-upload-input" title="Change profile picture" />
              <div class="db__pro-avatar">
                <Show when={user()?.image} keyed fallback={<span class="db__profile-initials">{initials()}</span>}>
                  {(image) => <img class="db__profile-img" src={image} alt="" />}
                </Show>
              </div>
            </div>
            <div class="db__pro-identity">
              <div class="db__pro-name-row">
                <h1 class="db__pro-name">{user()?.name ?? "Artist"}</h1>
<a class="db__pro-edit" href="/settings" title="Edit profile">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z"/></svg>
                </a>
              </div>
              <span class="db__pro-handle">@gaspaco</span>
            </div>
          </div>
        </div>
      </Show>

      <Show when={tab() === "library"}>
        <div class="db__content db__content--library">

            {/* ── Library header ── */}
          <div class="db__lib-header">
            <div class="db__lib-header-top">
              <h1 class="db__lib-title">Library</h1>
              <div class="db__lib-header-actions">
                <div class="db__lib-search">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 3 3" /></svg>
                  <input class="db__lib-search-input" type="text" placeholder="Search projects…" value={libSearch()} onInput={(e) => setLibSearch(e.currentTarget.value)} />
                </div>
                <button class="db__lib-new-btn" onClick={openCreate}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 4v12M4 10h12" /></svg>
                  <span>New project</span>
                </button>
              </div>
            </div>
            <nav class="db__lib-tabs">
              <button ref={el => { tabRefs["all"] = el; }} class={`db__lib-tab${libCat() === "all" ? " db__lib-tab--active" : ""}`} onClick={() => setLibCat("all")}>
                All
                <span class="db__lib-tab-badge">{projects().filter(p => p.name.toLowerCase().includes(libSearch().toLowerCase())).length}</span>
              </button>
              <button ref={el => { tabRefs["mine"] = el; }} class={`db__lib-tab${libCat() === "mine" ? " db__lib-tab--active" : ""}`} onClick={() => setLibCat("mine")}>Mine</button>
              <button ref={el => { tabRefs["liked"] = el; }} class={`db__lib-tab${libCat() === "liked" ? " db__lib-tab--active" : ""}`} onClick={() => setLibCat("liked")}>Liked</button>
              <span class="db__lib-tab-spacer">
                <span class="db__lib-tab-count">{projects().filter(p => p.name.toLowerCase().includes(libSearch().toLowerCase())).length} projects</span>
              </span>
              <button ref={el => { tabRefs["deleted"] = el; }} class={`db__lib-tab db__lib-tab--trash${libCat() === "deleted" ? " db__lib-tab--active" : ""}`} onClick={() => { setLibCat("deleted"); loadDeletedProjects(); }}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 6h12M7 6V4h6v2M8 9v6m4-6v6M5 6l1 10h8l1-10" /></svg>
                Trash
              </button>
              <div class="db__lib-tab-indicator" style={{ left: `${tabInd().left}px`, width: `${tabInd().width}px`, ...(tabInd().isTrash ? { background: "#ff5454" } : {}) }} />
            </nav>
          </div>

          {/* ── Project list ── */}
          <div class="db__lib-body" onClick={() => menuProjectId() && closeMenu()}>
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
                      <span class="db__lib-row-thumb-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" /></svg>
                      </span>
                      <span class="db__lib-row-play">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      </span>
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

      {/* Mobile bottom nav — only shown on ≤480px via CSS */}
      <nav class="db__mobile-nav">
        <button class={`db__mobile-nav-btn${tab() === "overview" ? " db__mobile-nav-btn--active" : ""}`} onClick={() => switchTab("overview")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span>Overview</span>
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
