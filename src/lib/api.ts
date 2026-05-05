// Thin fetch wrapper that attaches the user's JWT as a Bearer header
// so API routes can verify identity via JWKS without touching cookies.

import { getJWTToken } from "./auth";

async function bearerToken(): Promise<string | null> {
  try {
    return await getJWTToken();
  } catch {
    return null;
  }
}

async function call(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await bearerToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers, credentials: "include" });
  return res;
}

export interface ProjectListItem {
  id: string;
  name: string;
  bpm: number;
  updatedAt: string;
  trackCount: number;
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

export async function getProjectStatsApi(): Promise<{ studioHours: number }> {
  const res = await call("/api/projects/stats");
  if (!res.ok) return { studioHours: 0 };
  return res.json();
}
