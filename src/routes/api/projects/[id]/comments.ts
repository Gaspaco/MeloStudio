// GET    /api/projects/:id/comments — list comments
// POST   /api/projects/:id/comments — add comment
// DELETE /api/projects/:id/comments?commentId=<uuid> — delete own comment
import type { APIEvent } from "@solidjs/start/server";
import { requireUserId } from "~/lib/auth-server";
import { rateLimit } from "~/lib/server/rateLimit";
import { addComment, deleteComment, listComments } from "~/lib/db/social";
import { isUuid, textResponse } from "../../_utils";

export async function GET(event: APIEvent) {
  const rl = rateLimit(event.request, "comments:get", "relaxed");
  if (rl) return rl;
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);

  const comments = await listComments(id);
  return Response.json(comments);
}

export async function POST(event: APIEvent) {
  const rl = rateLimit(event.request, "comments:post", "standard");
  if (rl) return rl;
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = await event.request.json();
  } catch {
    return textResponse("invalid json", 400);
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 1000) return textResponse("body must be 1-1000 chars", 400);

  const comment = await addComment(userId, id, text);
  return Response.json(comment, { status: 201 });
}

export async function DELETE(event: APIEvent) {
  const rl = rateLimit(event.request, "comments:delete", "standard");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  const url = new URL(event.request.url);
  const commentId = url.searchParams.get("commentId") ?? "";
  if (!isUuid(commentId)) return textResponse("invalid commentId", 400);

  const deleted = await deleteComment(userId, commentId);
  if (!deleted) return textResponse("not found", 404);
  return new Response(null, { status: 204 });
}
