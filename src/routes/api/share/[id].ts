// GET /api/share/:id — public endpoint, no auth required.
// Returns project summary when published = true.
// Falls back to owner preview when the authenticated user owns the project.
import type { APIEvent } from "@solidjs/start/server";
import { getPublicProject, getProject } from "~/lib/db/projects";
import { requireUserId } from "~/lib/auth-server";

export async function GET(event: APIEvent) {
  const id = event.params.id;
  if (!id) return new Response("missing id", { status: 400 });

  // Try public project first (published = true, anyone can view)
  const publicProject = await getPublicProject(id);
  if (publicProject) return Response.json(publicProject);

  // Fall back: allow the owner to preview their own unpublished project
  const userId = await requireUserId(event.request);
  if (userId) {
    const owned = await getProject(userId, id);
    if (owned) {
      const doc = owned.doc;
      let durationSec = 0;
      for (const track of doc.tracks ?? []) {
        for (const clip of track.clips ?? []) {
          const end = (clip.startSec ?? 0) + (clip.durationSec ?? 0);
          if (end > durationSec) durationSec = end;
        }
      }
      const bpm = doc.transport?.bpm ?? 120;

      return Response.json({
        id,
        name: doc.name ?? "Untitled",
        bpm,
        key: doc.musicalKey ?? "—",
        trackCount: (doc.tracks ?? []).length,
        updatedAt: doc.updatedAt ?? new Date().toISOString(),
        isOwnerPreview: true,
        ownerId: userId,
        mixUrl: doc.mixUrl ?? null,
        durationSec,
      });
    }
  }

  return new Response("not found", { status: 404 });
}
