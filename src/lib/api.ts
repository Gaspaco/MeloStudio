// Tiny wrapper around fetch that attaches the current user's id as
// `x-user-id` so the server-side shim in src/lib/auth-server.ts can identify them.
// When we replace the shim with proper JWT verification, only this file changes.

import { authClient } from "./auth";

async function userId(): Promise<string | null> {
  try {
    const { data } = await authClient.getSession();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function call(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const id = await userId();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (id) headers.set("x-user-id", id);
  const res = await fetch(path, { ...init, headers, credentials: "include" });
  return res;
}

export interface ProjectListItem {
  id: string;
  name: string;
  bpm: number;
  updatedAt: string;
}

export async function listProjectsApi(): Promise<ProjectListItem[]> {
  const res = await call("/api/projects");
  if (!res.ok) throw new Error(`list projects: ${res.status}`);
  return res.json();
}

export async function createProjectApi(name = "Untitled Project"): Promise<{ id: string }> {
  const res = await call("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`create project: ${res.status}`);
  return res.json();
}

export async function updateProjectApi(id: string, updates: { name?: string }): Promise<void> {
  const res = await call(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`update project: ${res.status}`);
}

export async function deleteProjectApi(id: string): Promise<void> {
  const res = await call(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete project: ${res.status}`);
}
