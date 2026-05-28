// PUT /api/clips/:clipId?projectId=<uuid>  — upload audio blob (authenticated, project owner only)
// GET /api/clips/:clipId?projectId=<uuid>  — serve audio (public if project is published, else owner only)
// DELETE /api/clips/:clipId?projectId=<uuid> — remove audio (authenticated, project owner only)
import type { APIEvent } from "@solidjs/start/server";
import { getStore } from "@netlify/blobs";
import { requireUserId } from "~/lib/auth-server";
import { sql } from "~/lib/db/client";
import { isUuid, textResponse } from "../_utils";

const MAX_CLIP_BYTES = 50 * 1024 * 1024; // 50 MB hard cap per clip
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/ogg", "audio/flac", "audio/x-flac", "audio/aac", "audio/mp4",
  "audio/webm", "audio/3gpp", "audio/3gpp2",
  "video/mp4", "video/webm",
]);

function getClipsStore() {
  try {
    return getStore({ name: "audio-clips", consistency: "strong" });
  } catch {
    return null;
  }
}

async function getProjectOwner(projectId: string): Promise<{ userId: string; published: boolean } | null> {
  const rows = await sql`
    SELECT user_id, published FROM projects
    WHERE id = ${projectId} AND deleted_at IS NULL
    LIMIT 1
  ` as Array<{ user_id: string; published: boolean }>;
  if (!rows[0]) return null;
  return { userId: rows[0].user_id, published: rows[0].published };
}

export async function PUT(event: APIEvent) {
  const clipId = event.params.clipId;
  const projectId = new URL(event.request.url).searchParams.get("projectId") ?? "";

  if (!isUuid(clipId) || !isUuid(projectId)) return textResponse("invalid id", 400);

  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  const project = await getProjectOwner(projectId);
  if (!project) return textResponse("not found", 404);
  if (project.userId !== userId) return textResponse("forbidden", 403);

  const contentLength = parseInt(event.request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_CLIP_BYTES) return textResponse("file too large", 413);

  const contentType = (event.request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (contentType && !ALLOWED_AUDIO_TYPES.has(contentType)) {
    return textResponse("unsupported media type", 415);
  }

  const store = getClipsStore();
  if (!store) {
    return Response.json({ ok: true, stored: false }, { status: 200 });
  }

  try {
    const body = await event.request.arrayBuffer();
    if (body.byteLength === 0) return textResponse("empty body", 400);
    if (body.byteLength > MAX_CLIP_BYTES) return textResponse("file too large", 413);

    const key = `${projectId}/${clipId}`;
    await store.set(key, body, {
      metadata: { userId, projectId, mime: contentType || "audio/mpeg" },
    });
    return Response.json({ ok: true, stored: true }, { status: 200 });
  } catch (err) {
    console.error("[PUT /api/clips/:clipId] failed:", err);
    return textResponse("storage error", 500);
  }
}

export async function GET(event: APIEvent) {
  const clipId = event.params.clipId;
  const projectId = new URL(event.request.url).searchParams.get("projectId") ?? "";

  if (!isUuid(clipId) || !isUuid(projectId)) return textResponse("invalid id", 400);

  const project = await getProjectOwner(projectId);
  if (!project) return textResponse("not found", 404);

  if (!project.published) {
    const userId = await requireUserId(event.request);
    if (userId !== project.userId) return textResponse("not found", 404);
  }

  const store = getClipsStore();
  if (!store) return textResponse("storage not available", 503);

  try {
    const key = `${projectId}/${clipId}`;
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) return textResponse("clip not found", 404);

    const mime = (result.metadata as Record<string, string> | null)?.mime ?? "audio/mpeg";
    return new Response(result.data as ArrayBuffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    console.error("[GET /api/clips/:clipId] failed:", err);
    return textResponse("storage error", 500);
  }
}

export async function DELETE(event: APIEvent) {
  const clipId = event.params.clipId;
  const projectId = new URL(event.request.url).searchParams.get("projectId") ?? "";

  if (!isUuid(clipId) || !isUuid(projectId)) return textResponse("invalid id", 400);

  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  const project = await getProjectOwner(projectId);
  if (!project) return textResponse("not found", 404);
  if (project.userId !== userId) return textResponse("forbidden", 403);

  const store = getClipsStore();
  if (!store) return Response.json({ ok: true }, { status: 200 });

  try {
    await store.delete(`${projectId}/${clipId}`);
    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/clips/:clipId] failed:", err);
    return textResponse("storage error", 500);
  }
}
