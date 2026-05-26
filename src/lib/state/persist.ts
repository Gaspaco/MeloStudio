// Handles syncing the live SolidJS project state up to the database backbone.
// It exposes explicit load/save commands, but the primary mechanism is `startAutosave`:
// A reactive effect that wraps the entire project store. When any value inside the 
// project changes (e.g. dragging a clip), it trips a debounce timer. When the UI settles, 
// the complete structural snapshot is shipped to the Neon database via the internal API.

import { createEffect, on, onCleanup } from "solid-js";
import { apiFetch } from "~/lib/api";
import { hydrateProject, project } from "./projectStore";
import type { ProjectDoc } from "~/lib/audio/types";

const SAVE_DEBOUNCE_MS = 1500;

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetch(path, init);
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

export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> | null = null;

  const dispose = createEffect(
    on(
      // Solid tracks each field individually — batching them here means
      // any single-field change triggers the same debounce, not a separate timer.
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
          if (inflight) return; // don't queue a second save while one is in flight
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
