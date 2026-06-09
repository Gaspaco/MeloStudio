import { type Component, Show, createSignal, onMount } from "solid-js";
import "./profile.scss";

export interface ProfileProps {
  user: () => { name?: string; email?: string; image?: string; createdAt?: string } | null;
  initials: () => string;
  handleImageUpload: (e: Event & { currentTarget: HTMLInputElement }) => void;
  followCounts: () => { followers: number; following: number };
}

const BANNER_KEY = "ms_profile_banner";

const Profile: Component<ProfileProps> = (props) => {
  const [banner, setBanner] = createSignal<string | null>(null);

  onMount(() => {
    setBanner(localStorage.getItem(BANNER_KEY));
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
    </div>
  );
};

export default Profile;
