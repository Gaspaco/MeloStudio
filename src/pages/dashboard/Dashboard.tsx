import { type Component, createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { gsap } from "gsap";
import { authClient } from "../../lib/auth";
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
  onNewProject: () => void;
  onHome: () => void;
}> = (props) => {
  let pageRef!: HTMLDivElement;

  const [user, setUser] = createSignal<{
    name?: string;
    email?: string;
    image?: string;
    createdAt?: string;
  } | null>(null);
  const [projects] = createSignal<Project[]>([]);
  const [time, setTime] = createSignal(new Date());
  const [tab, setTab] = createSignal<Tab>("overview");

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

  onMount(async () => {
    try {
      const { data } = await authClient.getSession();
      if (data?.user) {
        setUser({
          name: data.user.name,
          email: data.user.email,
          image: data.user.image ?? undefined,
          createdAt: typeof data.user.createdAt === "string" ? data.user.createdAt : data.user.createdAt?.toISOString?.() ?? undefined,
        });
        setProfileName(data.user.name ?? "");
      }
    } catch {}
  });

  onMount(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    onCleanup(() => clearInterval(interval));
  });

  const handleLogout = async () => {
    try { await authClient.signOut(); } catch {}
    props.onLogout();
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

  const switchTab = (t: Tab) => {
    setTab(t);
    requestAnimationFrame(() => {
      gsap.fromTo(".db__content", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out" });
    });
  };

  // ── Entrance ──
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
      {/* ── Fixed nav bar ── */}
      <header class="db__bar">
        <button class="db__logo" onClick={props.onHome}>
          <span class="db__logo-melo">MELO</span>
          <span class="db__logo-studio">Studio</span>
        </button>

        <nav class="db__nav">
          <button class={`db__nav-link ${tab() === "overview" ? "db__nav-link--active" : ""}`} onClick={() => switchTab("overview")}>Overview</button>
          <button class={`db__nav-link ${tab() === "profile" ? "db__nav-link--active" : ""}`} onClick={() => switchTab("profile")}>Profile</button>
        </nav>

        <div class="db__bar-right">
          <span class="db__clock">{formatTime()}</span>
          <button class="db__bar-logout" onClick={handleLogout}>
            <span>Log out</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>

        <button class="db__avatar" onClick={() => switchTab("profile")}>
          <Show when={user()?.image} fallback={<span class="db__avatar-text">{initials()}</span>}>
            <img class="db__avatar-img" src={user()!.image!} alt="" />
          </Show>
        </button>
      </header>

      {/* ══════════════════════════ OVERVIEW ══════════════════════════ */}
      <Show when={tab() === "overview"}>
        <div class="db__content">
          {/* Hero */}
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

          {/* Stats strip */}
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
              <span class="db__stat-num">0h</span>
              <span class="db__stat-label">Studio Time</span>
              <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: "0%" }} /></span>
            </div>
            <div class="db__stat">
              <span class="db__stat-num">0</span>
              <span class="db__stat-label">Templates</span>
              <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: "0%" }} /></span>
            </div>
          </section>

          <div class="db__rule" />

          {/* Projects */}
          <section class="db__section">
            <div class="db__section-header">
              <span class="db__section-idx">01</span>
              <h2 class="db__section-title">Projects</h2>
              <button class="db__section-action" onClick={props.onNewProject}>
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
                <button class="db__empty-cta" onClick={props.onNewProject}>
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
                </div>
                <For each={projects()}>{(project, i) =>
                  <div class="db__table-row">
                    <span class="db__td db__td--num">{String(i() + 1).padStart(2, "0")}</span>
                    <span class="db__td db__td--name">
                      <span class="db__td-dot" style={{ background: project.color }} />
                      {project.name}
                    </span>
                    <span class="db__td db__td--bpm">{project.bpm}</span>
                    <span class="db__td db__td--key">{project.key}</span>
                    <span class="db__td db__td--tracks">{project.tracks}</span>
                    <span class="db__td db__td--time">{project.updatedAt}</span>
                  </div>
                }</For>
              </div>
            </Show>
          </section>

          <div class="db__rule" />

          {/* Quick actions */}
          <section class="db__section">
            <div class="db__section-header">
              <span class="db__section-idx">02</span>
              <h2 class="db__section-title">Quick Actions</h2>
            </div>

            <div class="db__actions">
              <button class="db__act" onClick={props.onNewProject}>
                <div class="db__act-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4v16m8-8H4" /></svg>
                </div>
                <div class="db__act-body">
                  <span class="db__act-label">New Project</span>
                  <span class="db__act-desc">Start a fresh session from scratch</span>
                </div>
                <svg class="db__act-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
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

          {/* Brand watermark */}
          <footer class="db__brand">
            <span class="db__brand-melo">Melo</span>
            <span class="db__brand-studio">Studio</span>
          </footer>
        </div>
      </Show>

      {/* ══════════════════════════ PROFILE ══════════════════════════ */}
      <Show when={tab() === "profile"}>
        <div class="db__content">
          {/* Profile hero */}
          <section class="db__profile-hero">
            <div class="db__profile-avatar-wrap">
              <div class="db__profile-avatar">
                <Show when={user()?.image} fallback={<span class="db__profile-initials">{initials()}</span>}>
                  <img class="db__profile-img" src={user()!.image!} alt="" />
                </Show>
              </div>
              <div class="db__profile-ring" />
            </div>
            <div class="db__profile-text">
              <h1 class="db__profile-name">{user()?.name ?? "—"}</h1>
              <span class="db__profile-email">{user()?.email}</span>
              <div class="db__profile-badges">
                <span class="db__badge db__badge--accent">Since {memberSince()}</span>
                <span class="db__badge">{projects().length} projects</span>
                <span class="db__badge">{totalTracks()} tracks</span>
              </div>
            </div>
          </section>

          <div class="db__rule" />

          {/* Edit Profile */}
          <section class="db__section">
            <div class="db__section-header">
              <span class="db__section-idx">01</span>
              <h2 class="db__section-title">Edit Profile</h2>
            </div>

            <div class="db__form-rows">
              <div class="db__frow">
                <label class="db__flabel">Display Name</label>
                <input class="db__finput" type="text" value={profileName()} onInput={(e) => setProfileName(e.currentTarget.value)} placeholder="Your name" />
                <div class="db__fline" />
              </div>

              <div class="db__frow">
                <label class="db__flabel">Email</label>
                <input class="db__finput db__finput--locked" type="email" value={user()?.email ?? ""} disabled />
                <div class="db__fline" />
                <span class="db__fhint">Managed by your auth provider</span>
              </div>

              <div class="db__frow-pair">
                <div class="db__frow">
                  <label class="db__flabel">Instagram</label>
                  <div class="db__finput-pre">
                    <span class="db__fpre">@</span>
                    <input class="db__finput" type="text" value={profileInstagram()} onInput={(e) => setProfileInstagram(e.currentTarget.value)} placeholder="username" />
                  </div>
                  <div class="db__fline" />
                </div>
                <div class="db__frow">
                  <label class="db__flabel">Twitter / X</label>
                  <div class="db__finput-pre">
                    <span class="db__fpre">@</span>
                    <input class="db__finput" type="text" value={profileTwitter()} onInput={(e) => setProfileTwitter(e.currentTarget.value)} placeholder="handle" />
                  </div>
                  <div class="db__fline" />
                </div>
              </div>

              <div class="db__frow">
                <label class="db__flabel">Website</label>
                <input class="db__finput" type="url" value={profileWebsite()} onInput={(e) => setProfileWebsite(e.currentTarget.value)} placeholder="https://yoursite.com" />
                <div class="db__fline" />
              </div>

              <div class="db__frow">
                <label class="db__flabel">Bio</label>
                <textarea class="db__ftextarea" value={profileBio()} onInput={(e) => setProfileBio(e.currentTarget.value)} placeholder="Tell the world about yourself..." rows={3} />
                <div class="db__fline" />
              </div>
            </div>

            <div class="db__form-btns">
              <button class="db__btn db__btn--fill" onClick={handleSaveProfile} disabled={profileSaving()}>
                {profileSaving() ? "Saving..." : profileSaved() ? "Saved ✓" : "Save Changes"}
              </button>
              <button class="db__btn db__btn--ghost" onClick={() => { setProfileName(user()?.name ?? ""); setProfileBio(""); setProfileInstagram(""); setProfileTwitter(""); setProfileWebsite(""); }}>
                Reset
              </button>
            </div>
          </section>

          <div class="db__rule" />

          {/* Change Password */}
          <section class="db__section">
            <div class="db__section-header">
              <span class="db__section-idx">02</span>
              <h2 class="db__section-title">Change Password</h2>
            </div>

            <div class="db__form-rows">
              <div class="db__frow-pair">
                <div class="db__frow">
                  <label class="db__flabel">Current Password</label>
                  <input class="db__finput" type="password" value={currentPassword()} onInput={(e) => setCurrentPassword(e.currentTarget.value)} placeholder="••••••••" />
                  <div class="db__fline" />
                </div>
                <div class="db__frow">
                  <label class="db__flabel">New Password</label>
                  <input class="db__finput" type="password" value={newPassword()} onInput={(e) => setNewPassword(e.currentTarget.value)} placeholder="Min 8 characters" />
                  <div class="db__fline" />
                </div>
              </div>
            </div>

            <Show when={passwordError()}>
              <span class="db__form-err">{passwordError()}</span>
            </Show>

            <div class="db__form-btns">
              <button class="db__btn db__btn--ghost" onClick={handleChangePassword}>
                {passwordSaved() ? "Updated ✓" : "Update Password"}
              </button>
            </div>
          </section>

          <div class="db__rule" />

          {/* Danger */}
          <section class="db__section db__section--danger">
            <div class="db__section-header">
              <span class="db__section-idx db__section-idx--danger">03</span>
              <h2 class="db__section-title">Danger Zone</h2>
            </div>

            <div class="db__danger">
              <div class="db__danger-info">
                <span class="db__danger-label">Delete Account</span>
                <span class="db__danger-sub">Permanently delete your account and all data. This cannot be undone.</span>
              </div>
              <button class="db__btn db__btn--danger">Delete Account</button>
            </div>
          </section>

          {/* Brand watermark */}
          <footer class="db__brand">
            <span class="db__brand-melo">Melo</span>
            <span class="db__brand-studio">Studio</span>
          </footer>
        </div>
      </Show>
    </div>
  );
};

export default Dashboard;
