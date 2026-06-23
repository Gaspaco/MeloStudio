// GET /api/discover/projects?genre=X&sort=recent|popular&limit=N&offset=N
// Public — returns published projects for the global feed.
import type { APIEvent } from "@solidjs/start/server";
import { sql } from "~/lib/db/client";
import { rateLimit } from "~/lib/server/rateLimit";
import { textResponse } from "../_utils";

export async function GET(event: APIEvent) {
  const rl = rateLimit(event.request, "discover:projects", "relaxed");
  if (rl) return rl;

  const url = new URL(event.request.url);
  const genre = url.searchParams.get("genre") || null;
  const sort = url.searchParams.get("sort") === "popular" ? "popular" : "recent";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  try {
    let rows;
    if (sort === "popular") {
      if (genre) {
        rows = await sql`
          SELECT p.id, p.name, p.bpm, p.user_id, p.updated_at, p.cover_url,
            p.data->>'genre' AS genre,
            p.data->>'description' AS description,
            (SELECT COUNT(*)::int FROM project_likes pl WHERE pl.project_id = p.id) AS like_count,
            (SELECT COUNT(*)::int FROM project_comments pc WHERE pc.project_id = p.id) AS comment_count
          FROM projects p
          WHERE p.published = TRUE AND p.deleted_at IS NULL AND p.data->>'unlisted' IS DISTINCT FROM 'true' AND p.data->>'genre' = ${genre}
          ORDER BY like_count DESC, p.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        rows = await sql`
          SELECT p.id, p.name, p.bpm, p.user_id, p.updated_at, p.cover_url,
            p.data->>'genre' AS genre,
            p.data->>'description' AS description,
            (SELECT COUNT(*)::int FROM project_likes pl WHERE pl.project_id = p.id) AS like_count,
            (SELECT COUNT(*)::int FROM project_comments pc WHERE pc.project_id = p.id) AS comment_count
          FROM projects p
          WHERE p.published = TRUE AND p.deleted_at IS NULL AND p.data->>'unlisted' IS DISTINCT FROM 'true'
          ORDER BY like_count DESC, p.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    } else {
      if (genre) {
        rows = await sql`
          SELECT p.id, p.name, p.bpm, p.user_id, p.updated_at, p.cover_url,
            p.data->>'genre' AS genre,
            p.data->>'description' AS description,
            (SELECT COUNT(*)::int FROM project_likes pl WHERE pl.project_id = p.id) AS like_count,
            (SELECT COUNT(*)::int FROM project_comments pc WHERE pc.project_id = p.id) AS comment_count
          FROM projects p
          WHERE p.published = TRUE AND p.deleted_at IS NULL AND p.data->>'unlisted' IS DISTINCT FROM 'true' AND p.data->>'genre' = ${genre}
          ORDER BY p.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        rows = await sql`
          SELECT p.id, p.name, p.bpm, p.user_id, p.updated_at, p.cover_url,
            p.data->>'genre' AS genre,
            p.data->>'description' AS description,
            (SELECT COUNT(*)::int FROM project_likes pl WHERE pl.project_id = p.id) AS like_count,
            (SELECT COUNT(*)::int FROM project_comments pc WHERE pc.project_id = p.id) AS comment_count
          FROM projects p
          WHERE p.published = TRUE AND p.deleted_at IS NULL AND p.data->>'unlisted' IS DISTINCT FROM 'true'
          ORDER BY p.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    }

    const items = (rows as Array<Record<string, unknown>>).map((r) => ({
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
    console.error("[GET /api/discover/projects]", err);
    return textResponse("server error", 500);
  }
}
