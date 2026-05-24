// GET /api/share/:id — public endpoint, no auth required.
// Returns project summary when published = true.
// Falls back to owner preview when the authenticated user owns the project.
import type { APIEvent } from "@solidjs/start/server";
import { getPublicProject, getProject } from "~/lib/db/projects";
import { requireUserId } from "~/lib/auth-server";
import { getProjectDurationSec, getProjectTrackCount } from "~/lib/audio/projectTimeline";
import { isUuid, textResponse } from "../_utils";

export async function GET(event: APIEvent) {
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);

  try {
    // Try public project first (published = true, anyone can view)
    const publicProject = await getPublicProject(id);
    if (publicProject) return Response.json(publicProject);

    // Fall back: allow the owner to preview their own unpublished project
    const userId = await requireUserId(event.request);
    if (userId) {
      const owned = await getProject(userId, id);
      if (owned) {
        const doc = owned.doc;
        const bpm = doc.transport?.bpm ?? 120;

        return Response.json({
          id,
          name: doc.name ?? "Untitled",
          bpm,
          key: doc.musicalKey ?? "—",
          trackCount: getProjectTrackCount(doc),
          createdAt: doc.createdAt ?? new Date().toISOString(),
          updatedAt: doc.updatedAt ?? new Date().toISOString(),
          isOwnerPreview: true,
          ownerId: userId,
          mixUrl: doc.mixUrl ?? null,
          durationSec: getProjectDurationSec(doc, bpm),
          lyrics: doc.lyrics ?? null,
        });
      }
    }

    return textResponse("not found", 404);
  } catch (err) {
    console.error("[GET /api/share/:id] failed:", err);
    return textResponse("server error", 500);
  }
}
