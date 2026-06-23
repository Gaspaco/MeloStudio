// GET   /api/notifications       — list notifications (with unread count)
// PATCH /api/notifications       — mark all read
import type { APIEvent } from "@solidjs/start/server";
import { requireUserId } from "~/lib/auth-server";
import { rateLimit } from "~/lib/server/rateLimit";
import { listNotifications, getUnreadCount, markAllRead } from "~/lib/db/notifications";
import { textResponse } from "../_utils";

export async function GET(event: APIEvent) {
  const rl = rateLimit(event.request, "notifications:get", "standard");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  const [items, unread] = await Promise.all([
    listNotifications(userId),
    getUnreadCount(userId),
  ]);
  return Response.json({ items, unread });
}

export async function PATCH(event: APIEvent) {
  const rl = rateLimit(event.request, "notifications:patch", "standard");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  await markAllRead(userId);
  return new Response(null, { status: 204 });
}
