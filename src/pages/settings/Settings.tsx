import { type Component, createSignal, createResource, Show, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authClient } from "../../lib/auth";
import { getAppSession, signOutApp } from "../../lib/app-auth";
import "./settings.scss";

type Section = "profile" | "account" | "security";

const Settings: Component = () => {
  const navigate = useNavigate();
  const [section, setSection] = createSignal<Section>("profile");

  const [user, setUser] = createSignal<{
    name?: string;
    email?: string;
    image?: string;
  } | null>(null);

  const [profileName, setProfileName] = createSignal("");
  const [profileBio, setProfileBio] = createSignal("");
  const [profileInstagram, setProfileInstagram] = createSignal("");
  const [profileTwitter, setProfileTwitter] = createSignal("");
  const [profileWebsite, setProfileWebsite] = createSignal("");
  const [profileSaving, setProfileSaving] = createSignal(false);
  const [profileSaved, setProfileSaved] = createSignal(false);

  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [passwordError, setPasswordError] = createSignal("");
  const [passwordSaved, setPasswordSaved] = createSignal(false);

  const [deleteStep, setDeleteStep] = createSignal<"none" | "confirm">("none");

  createResource(async () => {
    try {
      const userData = (await getAppSession())?.user;
      if (userData) {
        const rawImage = userData.image ?? undefined;
        const image = rawImage?.replace(/_normal(\.[^.]+)$/, "_400x400$1") ?? rawImage;
        setUser({ name: userData.name, email: userData.email, image });
        setProfileName(userData.name ?? "");
      }
    } catch {}
  });

  const initials = () => {
    const n = user()?.name ?? "?";
    const parts = n.split(" ");
    return parts.length > 1
      ? ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  };

  const handleImageUpload = (e: Event & { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const result = evt.target?.result as string;
      try { await authClient.updateUser({ image: result }); } catch {}
      setUser((u) => (u ? { ...u, image: result } : u));
    };
    reader.readAsDataURL(file);
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

  const handleDeleteAccount = async () => {
    try {
      await authClient.deleteUser();
      await signOutApp();
      navigate("/login", { replace: true });
    } catch {}
  };

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(saveTimer));

  return (
    <div class="st">
      <nav class="st__topbar">
        <a class="st__topbar-logo" href="/">
          <span class="st__topbar-melo">Melo</span><span class="st__topbar-studio">Studio</span>
        </a>
      </nav>

      <div class="st__shell">
        {/* Sidebar */}
        <aside class="st__sidebar">
          <a class="st__back" href="/dashboard">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 3L5 8l5 5"/></svg>
            Back to Dashboard
          </a>

          <div class="st__sidebar-nav">
            <button class={`st__sidebar-link${section() === "profile" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("profile")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10" cy="7" r="3.5"/><path d="M3 17.5c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/></svg>
              Profile
            </button>
            <button class={`st__sidebar-link${section() === "account" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("account")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M3 8h14"/></svg>
              Account
            </button>
            <button class={`st__sidebar-link${section() === "security" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("security")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="9" width="10" height="8" rx="2"/><path d="M7 9V7a3 3 0 0 1 6 0v2"/></svg>
              Security
            </button>
          </div>
        </aside>

        {/* Content */}
        <main class="st__main">

          {/* ── Profile ── */}
          <Show when={section() === "profile"}>
            <div class="st__section">
              <h1 class="st__section-title">Profile Settings</h1>

              <div class="st__avatar-row">
                <div class="st__avatar-wrap">
                  <input type="file" accept="image/*" onChange={handleImageUpload} class="st__avatar-input" title="Change photo" />
                  <div class="st__avatar">
                    <Show when={user()?.image} keyed fallback={<span class="st__avatar-initials">{initials()}</span>}>
                      {(img) => <img class="st__avatar-img" src={img} alt="" />}
                    </Show>
                  </div>
                  <div class="st__avatar-overlay">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 3H7L5 7H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2-4z"/><circle cx="10" cy="12" r="3"/></svg>
                  </div>
                </div>
              </div>

              <div class="st__fields">
                <div class="st__field">
                  <label class="st__field-label">Name</label>
                  <input class="st__field-input" type="text" value={profileName()} onInput={(e) => setProfileName(e.currentTarget.value)} placeholder="Your name" />
                </div>

                <div class="st__field st__field--locked">
                  <label class="st__field-label">
                    Email
                    <span class="st__field-badge">
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="5.5" width="8" height="5.5" rx="1"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/></svg>
                    </span>
                  </label>
                  <input class="st__field-input" type="email" value={user()?.email ?? ""} disabled />
                </div>

                <div class="st__field">
                  <label class="st__field-label">About</label>
                  <textarea class="st__field-textarea" value={profileBio()} onInput={(e) => setProfileBio(e.currentTarget.value)} placeholder="Describe yourself in a few words..." rows={4} />
                </div>
              </div>

              <div class="st__divider" />

              <h2 class="st__subsection-title">Links</h2>
              <div class="st__fields">
                <div class="st__field">
                  <label class="st__field-label">Website</label>
                  <div class="st__field-prefix">
                    <span class="st__field-prefix-icon">
                      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="7" cy="7" r="5.5"/><path d="M1.5 7h11M7 1.5c-1.5 2-2 3.5-2 5.5s.5 3.5 2 5.5M7 1.5c1.5 2 2 3.5 2 5.5s-.5 3.5-2 5.5"/></svg>
                    </span>
                    <input class="st__field-input" type="url" value={profileWebsite()} onInput={(e) => setProfileWebsite(e.currentTarget.value)} placeholder="https://yoursite.com" />
                  </div>
                </div>

                <div class="st__field-row">
                  <div class="st__field">
                    <label class="st__field-label">Instagram</label>
                    <div class="st__field-prefix">
                      <span class="st__field-prefix-at">@</span>
                      <input class="st__field-input" type="text" value={profileInstagram()} onInput={(e) => setProfileInstagram(e.currentTarget.value)} placeholder="username" />
                    </div>
                  </div>
                  <div class="st__field">
                    <label class="st__field-label">Twitter / X</label>
                    <div class="st__field-prefix">
                      <span class="st__field-prefix-at">@</span>
                      <input class="st__field-input" type="text" value={profileTwitter()} onInput={(e) => setProfileTwitter(e.currentTarget.value)} placeholder="handle" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="st__actions">
                <button class="st__btn st__btn--primary" onClick={handleSaveProfile} disabled={profileSaving()}>
                  {profileSaving() ? "Saving..." : profileSaved() ? "Saved" : "Save Changes"}
                </button>
                <button class="st__btn st__btn--ghost" onClick={() => { setProfileName(user()?.name ?? ""); setProfileBio(""); setProfileInstagram(""); setProfileTwitter(""); setProfileWebsite(""); }}>
                  Reset
                </button>
              </div>
            </div>
          </Show>

          {/* ── Account ── */}
          <Show when={section() === "account"}>
            <div class="st__section">
              <h1 class="st__section-title">Account</h1>

              <div class="st__info-row">
                <div class="st__info-item">
                  <span class="st__info-label">Email</span>
                  <span class="st__info-value">{user()?.email ?? "—"}</span>
                </div>
                <div class="st__info-item">
                  <span class="st__info-label">Plan</span>
                  <span class="st__info-value">Free</span>
                </div>
              </div>

              <div class="st__divider" />

              <h2 class="st__subsection-title st__subsection-title--danger">Danger Zone</h2>
              <p class="st__danger-desc">Permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.</p>

              <Show when={deleteStep() === "none"}>
                <div class="st__actions">
                  <button class="st__btn st__btn--danger" onClick={() => setDeleteStep("confirm")}>Delete Account</button>
                </div>
              </Show>
              <Show when={deleteStep() === "confirm"}>
                <div class="st__confirm-bar">
                  <span class="st__confirm-text">Are you sure? This is irreversible.</span>
                  <button class="st__btn st__btn--danger" onClick={handleDeleteAccount}>Yes, delete</button>
                  <button class="st__btn st__btn--ghost" onClick={() => setDeleteStep("none")}>Cancel</button>
                </div>
              </Show>
            </div>
          </Show>

          {/* ── Security ── */}
          <Show when={section() === "security"}>
            <div class="st__section">
              <h1 class="st__section-title">Security</h1>

              <h2 class="st__subsection-title">Change Password</h2>
              <div class="st__fields">
                <div class="st__field">
                  <label class="st__field-label">Current Password</label>
                  <input class="st__field-input" type="password" value={currentPassword()} onInput={(e) => setCurrentPassword(e.currentTarget.value)} placeholder="••••••••" />
                </div>
                <div class="st__field">
                  <label class="st__field-label">New Password</label>
                  <input class="st__field-input" type="password" value={newPassword()} onInput={(e) => setNewPassword(e.currentTarget.value)} placeholder="Min 8 characters" />
                </div>
              </div>

              <Show when={passwordError()}>
                <span class="st__err">{passwordError()}</span>
              </Show>

              <div class="st__actions">
                <button class="st__btn st__btn--ghost" onClick={handleChangePassword}>
                  {passwordSaved() ? "Updated" : "Update Password"}
                </button>
              </div>
            </div>
          </Show>

        </main>
      </div>
    </div>
  );
};

export default Settings;
