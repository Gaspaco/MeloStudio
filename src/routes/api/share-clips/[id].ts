// GET /api/share-clips/:id
// Returns structured playback metadata for a project.
// Allows published projects (anyone) or the authenticated owner (preview).
import type { APIEvent } from "@solidjs/start/server";
import { sql } from "~/lib/db/client";
import { requireUserId } from "~/lib/auth-server";
import { getProjectDurationSec, getSharePlaybackTracks, type TimelineDoc } from "~/lib/audio/projectTimeline";

interface SavedStepPattern {
  steps?: number;
  bpm?: number;
  rows?: Array<{
    drum: string;
    velocities?: number[];
    gainDb?: number;
    muted?: boolean;
  }>;
}

export async function GET(event: APIEvent) {
  const id = event.params.id;
  if (!id) return new Response("missing id", { status: 400 });

  // Allow published projects (public) or owner preview (authenticated)
  const rows = await sql`
    SELECT data, bpm, user_id, published FROM projects
    WHERE id = ${id} AND deleted_at IS NULL
    LIMIT 1
  ` as Array<{ data: TimelineDoc & { transport?: { bpm?: number }; beat?: { pattern?: SavedStepPattern } }; bpm: number; user_id: string; published: boolean }>;

  if (!rows[0]) return new Response("not found", { status: 404 });

  const row = rows[0];
  if (!row.published) {
    const userId = await requireUserId(event.request);
    if (userId !== row.user_id) return new Response("not found", { status: 404 });
  }

  const doc = row.data;
  const bpm: number = doc.transport?.bpm ?? row.bpm ?? 120;
  const tracks = getSharePlaybackTracks(doc, bpm);

  const pattern = doc.beat?.pattern;
  const hasDrums = !!pattern?.rows?.some((row) =>
    !row.muted && (row.velocities ?? []).some((velocity) => velocity > 0),
  );

  return Response.json({ bpm, tracks, durationSec: getProjectDurationSec(doc, bpm), pattern: hasDrums ? pattern : null });
}
