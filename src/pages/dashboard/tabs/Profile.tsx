import { type Component, Show } from "solid-js";
import "./profile.scss";

export interface ProfileProps {
  user: () => { name?: string; email?: string; image?: string; createdAt?: string } | null;
  initials: () => string;
  handleImageUpload: (e: Event & { currentTarget: HTMLInputElement }) => void;
  followCounts: () => { followers: number; following: number };
}

const Profile: Component<ProfileProps> = (props) => {
  return (
    <div class="db__content db__content--profile">
      <div class="db__pro-header">
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
          <span class="db__pro-handle">@gaspaco</span>
        </div>

        <div class="db__pro-follow-panel">
          <div class="db__pro-follow-stat">
            <span class="db__pro-follow-count">{props.followCounts().followers.toLocaleString()}</span>
            <span class="db__pro-follow-label">Followers</span>
          </div>
          <div class="db__pro-follow-divider" />
          <div class="db__pro-follow-stat">
            <span class="db__pro-follow-count">{props.followCounts().following.toLocaleString()}</span>
            <span class="db__pro-follow-label">Following</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
