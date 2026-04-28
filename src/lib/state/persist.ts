// Project persistence: load from API, debounced autosave to API.

import { createEffect, on, onCleanup } from "solid-js";
import { hydrateProject, project } from "./projectStore";
import type { ProjectDoc } from "~/lib/audio/types";

const SAVE_DEBOUNCE_MS = 1500;

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res;
}

export async function loadProject(id: string): Promise<void> {
  const res = await api(`/api/projects/${id}`);
  const doc = (await res.json()) as ProjectDoc;
  hydrateProject(doc);
}

export async function saveProjectNow(): Promise<void> {
  if (!project.id) return;
  await api(`/api/projects/${project.id}`, {
    method: "PUT",
    body: JSON.stringify(project),
  });
}

/** Mount once: re-saves the project 1.5s after the last edit. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> | null = null;

  const dispose = createEffect(
    on(
      // Track everything the user might change — Solid will batch all of it.
      () => [
        project.id,
        project.name,
        project.master,
        project.transport,
        project.tracks,
        project.assets,
      ],
      () => {
        if (!project.id) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          if (inflight) return; // skip if a save is already going
          inflight = saveProjectNow().finally(() => (inflight = null));
        }, SAVE_DEBOUNCE_MS);
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });
  return () => {
    if (timer) clearTimeout(timer);
    void dispose;
  };
}
