// GET    /api/projects/:id/likes — get like count + whether current user liked
// POST   /api/projects/:id/likes — like
// DELETE /api/projects/:id/likes — unlike
import type { APIEvent } from "@solidjs/start/server";
import { requireUserId } from "~/lib/auth-server";
import { rateLimit } from "~/lib/server/rateLimit";
import { getLikeCount, hasLiked, likeProject, unlikeProject } from "~/lib/db/social";
import { isUuid, textResponse } from "../../_utils";

export async function GET(event: APIEvent) {
  const rl = rateLimit(event.request, "likes:get", "relaxed");
  if (rl) return rl;
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);

  const userId = await requireUserId(event.request).catch(() => null);
  const [count, liked] = await Promise.all([
    getLikeCount(id),
    userId ? hasLiked(userId, id) : false,
  ]);
  return Response.json({ count, liked });
}

export async function POST(event: APIEvent) {
  const rl = rateLimit(event.request, "likes:post", "standard");
  if (rl) return rl;
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  await likeProject(userId, id);
  const count = await getLikeCount(id);
  return Response.json({ count, liked: true });
}

export async function DELETE(event: APIEvent) {
  const rl = rateLimit(event.request, "likes:delete", "standard");
  if (rl) return rl;
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  await unlikeProject(userId, id);
  const count = await getLikeCount(id);
  return Response.json({ count, liked: false });
}
