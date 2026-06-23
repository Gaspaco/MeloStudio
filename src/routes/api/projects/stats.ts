// GET /api/projects/stats  – aggregate stats for the current user
import type { APIEvent } from "@solidjs/start/server";
import { getProjectStats } from "~/lib/db/projects";
import { requireUserId } from "~/lib/auth-server";
import { rateLimit } from "~/lib/server/rateLimit";
import { textResponse } from "../_utils";

export async function GET(event: APIEvent) {
  const rl = rateLimit(event.request, "stats", "standard");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);
  try {
    const stats = await getProjectStats(userId);
    return Response.json(stats);
  } catch (err) {
    console.error("[GET /api/projects/stats] failed:", err);
    return textResponse("server error", 500);
  }
}
