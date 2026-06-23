import type { APIEvent } from "@solidjs/start/server";
import { requireUserId } from "~/lib/auth-server";
import { rateLimit } from "~/lib/server/rateLimit";
import { textResponse } from "../_utils";
import { recordHeartbeat } from "~/lib/db/projects";

export async function POST(event: APIEvent) {
  const rl = rateLimit(event.request, "heartbeat", "relaxed");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);
  try {
    const body = await event.request.json().catch(() => ({}));
    const projectId = typeof body.projectId === "string" ? body.projectId : null;
    await recordHeartbeat(userId, projectId);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[POST /api/projects/heartbeat] failed:", err);
    return textResponse("server error", 500);
  }
}
