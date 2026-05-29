// PUT /api/clips/:clipId?projectId=<uuid>  — upload audio blob (authenticated, project owner only)
// GET /api/clips/:clipId?projectId=<uuid>  — serve audio (public if project is published, else owner only)
// DELETE /api/clips/:clipId?projectId=<uuid> — remove audio (authenticated, project owner only)
import type { APIEvent } from "@solidjs/start/server";
import { getStore } from "@netlify/blobs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireUserId } from "~/lib/auth-server";
import { sql } from "~/lib/db/client";
import { isUuid, textResponse } from "../_utils";

const MAX_CLIP_BYTES = 50 * 1024 * 1024; // 50 MB hard cap per clip
const LOCAL_CLIP_ROOT = join(process.cwd(), ".data", "audio-clips");
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/ogg", "audio/flac", "audio/x-flac", "audio/aac", "audio/mp4",
  "audio/webm", "audio/3gpp", "audio/3gpp2",
  "video/mp4", "video/webm",
]);

function getClipsStore() {
  try {
    return getStore({ name: "audio-clips" });
  } catch {
    return null;
  }
}

const canUseLocalClipStore = () => process.env.NODE_ENV !== "production";

const warnStorageFallback = (operation: string, err: unknown) => {
  if (canUseLocalClipStore()) {
    console.warn(`[${operation} /api/clips/:clipId] Netlify Blobs unavailable; using local clip store:`, err);
  } else {
    console.error(`[${operation} /api/clips/:clipId] Netlify Blobs error:`, err);
  }
};

const localClipPath = (projectId: string, clipId: string) =>
  join(LOCAL_CLIP_ROOT, projectId, `${clipId}.bin`);

const localMetaPath = (projectId: string, clipId: string) =>
  join(LOCAL_CLIP_ROOT, projectId, `${clipId}.json`);

async function setLocalClip(
  projectId: string,
  clipId: string,
  body: ArrayBuffer,
  metadata: Record<string, string>,
): Promise<boolean> {
  if (!canUseLocalClipStore()) return false;
  const dir = join(LOCAL_CLIP_ROOT, projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(localClipPath(projectId, clipId), new Uint8Array(body));
  await writeFile(localMetaPath(projectId, clipId), JSON.stringify(metadata));
  return true;
}

async function getLocalClip(projectId: string, clipId: string): Promise<{ data: Uint8Array; mime: string } | null> {
  if (!canUseLocalClipStore()) return null;
  try {
    const [data, metaRaw] = await Promise.all([
      readFile(localClipPath(projectId, clipId)),
      readFile(localMetaPath(projectId, clipId), "utf8").catch(() => "{}"),
    ]);
    const metadata = JSON.parse(metaRaw) as { mime?: string };
    return { data, mime: metadata.mime || "audio/mpeg" };
  } catch {
    return null;
  }
}

function localClipResponse(local: { data: Uint8Array; mime: string }): Response {
  const body = new ArrayBuffer(local.data.byteLength);
  new Uint8Array(body).set(local.data);
  return new Response(body, {
    headers: {
      "Content-Type": local.mime,
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
}

async function deleteLocalClip(projectId: string, clipId: string): Promise<void> {
  if (!canUseLocalClipStore()) return;
  await Promise.all([
    rm(localClipPath(projectId, clipId), { force: true }),
    rm(localMetaPath(projectId, clipId), { force: true }),
  ]);
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

  let project: { userId: string; published: boolean } | null = null;
  try {
    project = await getProjectOwner(projectId);
  } catch (err) {
    console.error("[PUT /api/clips/:clipId] DB error:", err);
    return textResponse("internal error", 500);
  }
  if (!project) return textResponse("not found", 404);
  if (project.userId !== userId) return textResponse("forbidden", 403);

  const contentLength = parseInt(event.request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_CLIP_BYTES) return textResponse("file too large", 413);

  const contentType = (event.request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (contentType && !ALLOWED_AUDIO_TYPES.has(contentType)) {
    return textResponse("unsupported media type", 415);
  }

  try {
    const body = await event.request.arrayBuffer();
    if (body.byteLength === 0) return textResponse("empty body", 400);
    if (body.byteLength > MAX_CLIP_BYTES) return textResponse("file too large", 413);

    const key = `${projectId}/${clipId}`;
    const metadata = { userId, projectId, mime: contentType || "audio/mpeg" };
    const store = getClipsStore();
    if (!store) {
      const stored = await setLocalClip(projectId, clipId, body, metadata);
      return Response.json({ ok: true, stored, local: stored }, { status: 200 });
    }

    try {
      await store.set(key, body, {
        metadata,
      });
      return Response.json({ ok: true, stored: true }, { status: 200 });
    } catch (err) {
      warnStorageFallback("PUT", err);
      const stored = await setLocalClip(projectId, clipId, body, metadata);
      if (stored) return Response.json({ ok: true, stored: true, local: true }, { status: 200 });
      throw err;
    }
  } catch (err) {
    console.error("[PUT /api/clips/:clipId] failed:", err);
    return textResponse("storage error", 500);
  }
}

export async function GET(event: APIEvent) {
  const clipId = event.params.clipId;
  const projectId = new URL(event.request.url).searchParams.get("projectId") ?? "";

  if (!isUuid(clipId) || !isUuid(projectId)) return textResponse("invalid id", 400);

  let project: { userId: string; published: boolean } | null = null;
  try {
    project = await getProjectOwner(projectId);
  } catch (err) {
    console.error("[GET /api/clips/:clipId] DB error:", err);
    return textResponse("internal error", 500);
  }
  if (!project) return textResponse("not found", 404);

  if (!project.published) {
    const userId = await requireUserId(event.request);
    if (userId !== project.userId) return textResponse("not found", 404);
  }

  const store = getClipsStore();
  if (!store) {
    const local = await getLocalClip(projectId, clipId);
    if (!local) return textResponse(canUseLocalClipStore() ? "clip not found" : "storage not available", canUseLocalClipStore() ? 404 : 503);
    return localClipResponse(local);
  }

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
    warnStorageFallback("GET", err);
    const local = await getLocalClip(projectId, clipId);
    if (local) return localClipResponse(local);
    if (canUseLocalClipStore()) return textResponse("clip not found", 404);
    console.error("[GET /api/clips/:clipId] storage error:", err);
    return textResponse("storage unavailable", 503);
  }
}

export async function DELETE(event: APIEvent) {
  const clipId = event.params.clipId;
  const projectId = new URL(event.request.url).searchParams.get("projectId") ?? "";

  if (!isUuid(clipId) || !isUuid(projectId)) return textResponse("invalid id", 400);

  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  let project: { userId: string; published: boolean } | null = null;
  try {
    project = await getProjectOwner(projectId);
  } catch (err) {
    console.error("[DELETE /api/clips/:clipId] DB error:", err);
    return textResponse("internal error", 500);
  }
  if (!project) return textResponse("not found", 404);
  if (project.userId !== userId) return textResponse("forbidden", 403);

  const store = getClipsStore();
  if (!store) {
    await deleteLocalClip(projectId, clipId);
    return Response.json({ ok: true }, { status: 200 });
  }

  try {
    await store.delete(`${projectId}/${clipId}`);
    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    warnStorageFallback("DELETE", err);
    if (canUseLocalClipStore()) {
      await deleteLocalClip(projectId, clipId);
      return Response.json({ ok: true, local: true }, { status: 200 });
    }
    console.error("[DELETE /api/clips/:clipId] failed:", err);
    return textResponse("storage error", 500);
  }
}
