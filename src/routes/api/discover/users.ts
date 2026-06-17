// GET /api/discover/users?q=search+term&limit=N
// Searches users by name. Public endpoint.
import type { APIEvent } from "@solidjs/start/server";
import { sql } from "~/lib/db/client";
import { rateLimit } from "~/lib/server/rateLimit";
import { textResponse } from "../_utils";

export async function GET(event: APIEvent) {
  const rl = rateLimit(event.request, "discover:users", "standard");
  if (rl) return rl;

  const url = new URL(event.request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);

  if (!query || query.length < 2) return Response.json([]);

  try {
    const pattern = `%${query}%`;

    // Search both auth providers
    const rows = await sql`
      SELECT DISTINCT u.id, u.name, u.image,
        (SELECT COUNT(*)::int FROM projects p WHERE p.user_id = u.id AND p.published = TRUE AND p.deleted_at IS NULL) AS project_count,
        (SELECT COUNT(*)::int FROM follows f WHERE f.following_id = u.id) AS follower_count
      FROM (
        SELECT id, name, image FROM neon_auth."user" WHERE name ILIKE ${pattern}
        UNION
        SELECT id, name, image FROM public."user" WHERE name ILIKE ${pattern}
      ) u
      ORDER BY follower_count DESC
      LIMIT ${limit}
    ` as Array<Record<string, unknown>>;

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      image: r.image ? true : false,
      projectCount: r.project_count ?? 0,
      followerCount: r.follower_count ?? 0,
    }));

    return Response.json(items);
  } catch (err) {
    console.error("[GET /api/discover/users]", err);
    return textResponse("server error", 500);
  }
}
