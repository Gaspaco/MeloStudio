// Thin fetch wrapper that attaches a Neon JWT only when Neon is the active auth
// provider. Better Auth/Twitter sessions authenticate via the included cookie.

import { getApiBearerToken } from "./app-auth";

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getApiBearerToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers, credentials: "include" });
}

export interface ProjectListItem {
  id: string;
  name: string;
  bpm: number;
  updatedAt: string;
  trackCount: number;
  published: boolean;
}

export async function listProjectsApi(): Promise<ProjectListItem[]> {
  const res = await apiFetch("/api/projects");
  if (!res.ok) throw new Error(`list projects: ${res.status}`);
  return res.json();
}

export async function createProjectApi(name = "Untitled Project"): Promise<{ id: string }> {
  const res = await apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`create project: ${res.status}`);
  return res.json();
}

export interface ProjectPatch {
  name?: string;
  genre?: string | null;
  description?: string | null;
  explicit?: boolean;
  unlisted?: boolean;
  lyrics?: string | null;
  published?: boolean;
  restore?: boolean;
}

export async function updateProjectApi(id: string, updates: ProjectPatch): Promise<void> {
  const res = await apiFetch(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`update project: ${res.status}`);
}

export async function deleteProjectApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete project: ${res.status}`);
}

export async function permanentlyDeleteProjectApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/projects/${id}?permanent=true`, { method: "DELETE" });
  if (!res.ok) throw new Error(`permanently delete project: ${res.status}`);
}

export async function restoreProjectApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ restore: true }),
  });
  if (!res.ok) throw new Error(`restore project: ${res.status}`);
}

export interface DeletedProjectListItem {
  id: string;
  name: string;
  bpm: number;
  deletedAt: string;
  expiresAt: string;
  trackCount: number;
}

export async function listDeletedProjectsApi(): Promise<DeletedProjectListItem[]> {
  const res = await apiFetch("/api/projects?deleted=true");
  if (!res.ok) throw new Error(`list deleted projects: ${res.status}`);
  return res.json();
}

export async function publishProjectApi(id: string, published: boolean): Promise<void> {
  const res = await apiFetch(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ published }),
  });
  if (!res.ok) throw new Error(`publish project: ${res.status}`);
}

// ── Likes ────────────────────────────────────────────────────────────────

export async function getLikesApi(projectId: string): Promise<{ count: number; liked: boolean }> {
  const res = await apiFetch(`/api/projects/${projectId}/likes`);
  if (!res.ok) return { count: 0, liked: false };
  return res.json();
}

export async function likeProjectApi(projectId: string): Promise<{ count: number; liked: boolean }> {
  const res = await apiFetch(`/api/projects/${projectId}/likes`, { method: "POST" });
  if (!res.ok) throw new Error(`like: ${res.status}`);
  return res.json();
}

export async function unlikeProjectApi(projectId: string): Promise<{ count: number; liked: boolean }> {
  const res = await apiFetch(`/api/projects/${projectId}/likes`, { method: "DELETE" });
  if (!res.ok) throw new Error(`unlike: ${res.status}`);
  return res.json();
}

// ── Comments ─────────────────────────────────────────────────────────────

export interface ProjectComment {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
}

export async function listCommentsApi(projectId: string): Promise<ProjectComment[]> {
  const res = await apiFetch(`/api/projects/${projectId}/comments`);
  if (!res.ok) return [];
  return res.json();
}

export async function addCommentApi(projectId: string, body: string): Promise<ProjectComment> {
  const res = await apiFetch(`/api/projects/${projectId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`comment: ${res.status}`);
  return res.json();
}

export async function deleteCommentApi(projectId: string, commentId: string): Promise<void> {
  const res = await apiFetch(`/api/projects/${projectId}/comments?commentId=${commentId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`delete comment: ${res.status}`);
}

// ── Stats ────────────────────────────────────────────────────────────────

export async function getProjectStatsApi(): Promise<{ studioHours: number }> {
  const res = await apiFetch("/api/projects/stats");
  if (!res.ok) return { studioHours: 0 };
  return res.json();
}

// ── Notifications ────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  actorId: string;
  projectId: string | null;
  commentId: string | null;
  read: boolean;
  createdAt: string;
}

export async function getNotificationsApi(): Promise<{ items: AppNotification[]; unread: number }> {
  const res = await apiFetch("/api/notifications");
  if (!res.ok) return { items: [], unread: 0 };
  return res.json();
}

export async function markNotificationsReadApi(): Promise<void> {
  await apiFetch("/api/notifications", { method: "PATCH" });
}

// ── Discover / Feed ──────────────────────────────────────────────────────

export interface FeedProject {
  id: string;
  name: string;
  bpm: number;
  userId: string;
  updatedAt: string;
  coverUrl: string | null;
  genre: string | null;
  description: string | null;
  likeCount: number;
  commentCount: number;
}

export async function discoverProjectsApi(opts?: { genre?: string; sort?: string; limit?: number; offset?: number }): Promise<FeedProject[]> {
  const params = new URLSearchParams();
  if (opts?.genre) params.set("genre", opts.genre);
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const res = await apiFetch(`/api/discover/projects?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getFeedApi(opts?: { limit?: number; offset?: number }): Promise<FeedProject[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const res = await apiFetch(`/api/feed?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export interface DiscoverUser {
  id: string;
  name: string;
  image: boolean;
  projectCount: number;
  followerCount: number;
}

export async function searchUsersApi(query: string): Promise<DiscoverUser[]> {
  const res = await apiFetch(`/api/discover/users?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}

// ── Follow ───────────────────────────────────────────────────────────────

export async function followUserApi(userId: string): Promise<void> {
  await apiFetch("/api/user/follows", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function unfollowUserApi(userId: string): Promise<void> {
  await apiFetch("/api/user/follows", {
    method: "DELETE",
    body: JSON.stringify({ userId }),
  });
}

// ── Heartbeat ────────────────────────────────────────────────────────────

export async function sendHeartbeat(projectId: string): Promise<void> {
  await apiFetch("/api/projects/heartbeat", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  }).catch(() => {});
}

export async function transcribeProjectApi(projectId: string): Promise<{ lrc: string }> {
  const res = await apiFetch("/api/transcribe", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `transcribe: ${res.status}`);
  }
  return res.json();
}

// ── URL builders — the only place URL shapes live ──────────────────
export const clipUrl = (projectId: string, clipId: string) =>
  `/api/clips/${encodeURIComponent(clipId)}?projectId=${encodeURIComponent(projectId)}`;

export const pfpUrl = (userId: string) =>
  `/api/user/${encodeURIComponent(userId)}/pfp`;

export const shareUrl = (projectId: string) =>
  `${window.location.origin}/share/${projectId}`;

export const isApiClipUrl = (url: string): boolean =>
  url.startsWith("/api/clips/") || url.includes(window.location.origin + "/api/clips/");

// ── Typed fetchers ──────────────────────────────────────────────────

export interface ShareProjectView {
  id: string;
  name: string;
  bpm: number;
  key?: string;
  trackCount: number;
  createdAt?: string;
  updatedAt?: string;
  isOwnerPreview?: boolean;
  ownerId?: string;
  mixUrl?: string;
  coverUrl?: string | null;
  durationSec?: number;
  genre?: string;
  description?: string;
  explicit?: boolean;
  lyrics?: string;
  published?: boolean;
}

export interface SharePlayback {
  bpm: number;
  durationSec?: number;
  pattern?: unknown | null;
  tracks: Array<{
    id: string;
    name: string;
    type: string;
    volume: number;
    muted: boolean;
    instrumentPreset?: string;
    clips: Array<{
      id: string;
      kind: "audio" | "video" | "midi";
      startSec: number;
      durationSec: number;
      dataUrl?: string;
      remoteUrl?: string;
      midiNotes?: Array<{ midi: number; startSec: number; durationSec: number; velocity: number }>;
    }>;
  }>;
}

export async function getShareProjectApi(id: string): Promise<ShareProjectView | null> {
  const res = await apiFetch(`/api/share/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getShareClipsApi(id: string): Promise<SharePlayback | null> {
  const res = await apiFetch(`/api/share-clips/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getProjectDocApi(id: string): Promise<{ doc: Record<string, unknown>; published: boolean } | null> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const raw = await res.json();
  // The server smuggles `_published` into the doc JSON — extract it here so callers never see it
  const { _published, ...doc } = raw as Record<string, unknown> & { _published?: boolean };
  return { doc, published: _published ?? false };
}

export async function putProjectDocApi(id: string, json: string): Promise<void> {
  // Strip _published from payload — it's a read-only server field
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const { _published: _p, ...rest } = parsed;
    payload = rest;
  } catch {
    payload = JSON.parse(json) as Record<string, unknown>;
  }
  const res = await apiFetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`put project doc: ${res.status}`);
}

export async function getFollowCountsApi(): Promise<{ followers: number; following: number }> {
  const res = await apiFetch("/api/user/follows");
  if (!res.ok) return { followers: 0, following: 0 };
  return res.json();
}
