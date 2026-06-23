// GET /api/feed?limit=N&offset=N
// Returns published projects from users the current user follows.
import type { APIEvent } from "@solidjs/start/server";
import { sql } from "~/lib/db/client";
import { requireUserId } from "~/lib/auth-server";
import { rateLimit } from "~/lib/server/rateLimit";
import { textResponse } from "./_utils";

export async function GET(event: APIEvent) {
  const rl = rateLimit(event.request, "feed", "standard");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  const url = new URL(event.request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  try {
    const rows = await sql`
      SELECT p.id, p.name, p.bpm, p.user_id, p.updated_at, p.cover_url,
        p.data->>'genre' AS genre,
        p.data->>'description' AS description,
        (SELECT COUNT(*)::int FROM project_likes pl WHERE pl.project_id = p.id) AS like_count,
        (SELECT COUNT(*)::int FROM project_comments pc WHERE pc.project_id = p.id) AS comment_count
      FROM projects p
      INNER JOIN follows f ON f.following_id = p.user_id AND f.follower_id = ${userId}
      WHERE p.published = TRUE AND p.deleted_at IS NULL
      ORDER BY p.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    ` as Array<Record<string, unknown>>;

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      bpm: r.bpm,
      userId: r.user_id,
      updatedAt: r.updated_at,
      coverUrl: r.cover_url,
      genre: r.genre,
      description: r.description,
      likeCount: r.like_count ?? 0,
      commentCount: r.comment_count ?? 0,
    }));

    return Response.json(items);
  } catch (err) {
    console.error("[GET /api/feed]", err);
    return textResponse("server error", 500);
  }
}
