// GET /api/projects/stats  – aggregate stats for the current user
import type { APIEvent } from "@solidjs/start/server";
import { getProjectStats } from "~/lib/db/projects";
import { requireUserId } from "~/lib/auth-server";

export async function GET(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const stats = await getProjectStats(userId);
  return Response.json(stats);
}
