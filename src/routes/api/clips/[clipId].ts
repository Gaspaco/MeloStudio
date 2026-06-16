// PUT /api/clips/:clipId?projectId=<uuid>  — upload audio blob (authenticated, project owner only)
// GET /api/clips/:clipId?projectId=<uuid>  — serve audio (public if project is published, else owner only)
// DELETE /api/clips/:clipId?projectId=<uuid> — remove audio (authenticated, project owner only)
import type { APIEvent } from "@solidjs/start/server";
import { getStore } from "@netlify/blobs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getReadAccess, getOwnerAccess } from "~/lib/server/projectAccess";
import { rateLimit } from "~/lib/server/rateLimit";
import { isUuid, textResponse } from "../_utils";

const MAX_CLIP_BYTES = 4_000_000; // Netlify buffered functions allow ~4.5 MB binary request bodies.
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
    const metaRaw = await readFile(localMetaPath(projectId, clipId), "utf8").catch(() => "{}");
    const metadata = JSON.parse(metaRaw) as { mime?: string; chunks?: string };
    
    if (metadata.chunks) {
      const chunks = parseInt(metadata.chunks, 10);
      const buffers = [];
      let totalSize = 0;
      for (let i = 0; i < chunks; i++) {
        const b = await readFile(localClipPath(projectId, `${clipId}_${i}`));
        buffers.push(b);
        totalSize += b.byteLength;
      }
      const finalBuffer = new Uint8Array(totalSize);
      let offset = 0;
      for (const b of buffers) {
        finalBuffer.set(b, offset);
        offset += b.byteLength;
      }
      return { data: finalBuffer, mime: metadata.mime || "audio/mpeg" };
    } else {
      const data = await readFile(localClipPath(projectId, clipId));
      return { data, mime: metadata.mime || "audio/mpeg" };
    }
  } catch {
    return null;
  }
}

function parseRange(header: string | null, total: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = header.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null;
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : total - 1;
  if (start >= total || end >= total || start > end) return null;
  return { start, end };
}

function localClipResponse(local: { data: Uint8Array; mime: string }, rangeHeader?: string | null): Response {
  const total = local.data.byteLength;
  const range = parseRange(rangeHeader ?? null, total);

  if (range) {
    const slice = local.data.slice(range.start, range.end + 1);
    return new Response(slice.buffer, {
      status: 206,
      headers: {
        "Content-Type": local.mime,
        "Content-Range": `bytes ${range.start}-${range.end}/${total}`,
        "Content-Length": String(slice.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const body = new ArrayBuffer(total);
  new Uint8Array(body).set(local.data);
  return new Response(body, {
    headers: {
      "Content-Type": local.mime,
      "Content-Length": String(total),
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
}


async function deleteLocalClip(projectId: string, clipId: string): Promise<void> {
  if (!canUseLocalClipStore()) return;
  const metaRaw = await readFile(localMetaPath(projectId, clipId), "utf8").catch(() => null);
  await Promise.all([
    rm(localClipPath(projectId, clipId), { force: true }),
    rm(localMetaPath(projectId, clipId), { force: true }),
  ]);
  if (metaRaw) {
    const meta = JSON.parse(metaRaw) as { chunks?: string };
    if (meta.chunks) {
      const chunks = parseInt(meta.chunks, 10);
      for (let i = 0; i < chunks; i++) {
        await rm(localClipPath(projectId, `${clipId}_${i}`), { force: true });
      }
    }
  }
}

export async function PUT(event: APIEvent) {
  const rl = rateLimit(event.request, "clips:put", "strict");
  if (rl) return rl;
  const clipId = event.params.clipId;
  const searchParams = new URL(event.request.url).searchParams;
  const projectId = searchParams.get("projectId") ?? "";
  const chunkStr = searchParams.get("chunk");
  const chunksStr = searchParams.get("chunks");

  if (!isUuid(clipId) || !isUuid(projectId)) return textResponse("invalid id", 400);

  let access: Awaited<ReturnType<typeof getOwnerAccess>>;
  try {
    access = await getOwnerAccess(event.request, projectId);
  } catch (err) {
    console.error("[PUT /api/clips/:clipId] DB error:", err);
    return textResponse("internal error", 500);
  }
  if (!access.ok) {
    if (access.reason === "unauthorized") return textResponse("unauthorized", 401);
    if (access.reason === "not-found") return textResponse("not found", 404);
    return textResponse("forbidden", 403);
  }
  const userId = access.userId;

  const contentLength = parseInt(event.request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_CLIP_BYTES) return textResponse("file too large", 413);

  const contentType = (event.request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (chunksStr === null && contentType && !ALLOWED_AUDIO_TYPES.has(contentType) && contentType !== "application/octet-stream") {
    return textResponse("unsupported media type", 415);
  }

  try {
    const body = await event.request.arrayBuffer();
    if (chunksStr === null && body.byteLength === 0) return textResponse("empty body", 400);
    if (body.byteLength > MAX_CLIP_BYTES) return textResponse("file too large", 413);

    const store = getClipsStore();

    if (chunkStr !== null) {
      const key = `${projectId}/${clipId}_${chunkStr}`;
      if (!store) {
        const dir = join(LOCAL_CLIP_ROOT, projectId);
        await mkdir(dir, { recursive: true });
        await writeFile(localClipPath(projectId, `${clipId}_${chunkStr}`), new Uint8Array(body));
        return Response.json({ ok: true, stored: true, local: true }, { status: 200 });
      }
      try {
        await store.set(key, body);
        return Response.json({ ok: true, stored: true }, { status: 200 });
      } catch (err) {
        warnStorageFallback("PUT_chunk", err);
        const dir = join(LOCAL_CLIP_ROOT, projectId);
        await mkdir(dir, { recursive: true });
        await writeFile(localClipPath(projectId, `${clipId}_${chunkStr}`), new Uint8Array(body));
        return Response.json({ ok: true, stored: true, local: true }, { status: 200 });
      }
    } else if (chunksStr !== null) {
      const key = `${projectId}/${clipId}`;
      const metadata = { userId, projectId, mime: contentType || "audio/mpeg", chunks: chunksStr };
      if (!store) {
        const dir = join(LOCAL_CLIP_ROOT, projectId);
        await mkdir(dir, { recursive: true });
        await writeFile(localMetaPath(projectId, clipId), JSON.stringify(metadata));
        return Response.json({ ok: true, stored: true, local: true }, { status: 200 });
      }
      try {
        await store.set(key, body, { metadata });
        return Response.json({ ok: true, stored: true }, { status: 200 });
      } catch (err) {
        warnStorageFallback("PUT_chunks", err);
        const dir = join(LOCAL_CLIP_ROOT, projectId);
        await mkdir(dir, { recursive: true });
        await writeFile(localMetaPath(projectId, clipId), JSON.stringify(metadata));
        return Response.json({ ok: true, stored: true, local: true }, { status: 200 });
      }
    } else {
      const key = `${projectId}/${clipId}`;
      const metadata = { userId, projectId, mime: contentType || "audio/mpeg" };
      if (!store) {
        const stored = await setLocalClip(projectId, clipId, body, metadata);
        return Response.json({ ok: true, stored, local: stored }, { status: 200 });
      }
      try {
        await store.set(key, body, { metadata });
        return Response.json({ ok: true, stored: true }, { status: 200 });
      } catch (err) {
        warnStorageFallback("PUT", err);
        const stored = await setLocalClip(projectId, clipId, body, metadata);
        if (stored) return Response.json({ ok: true, stored: true, local: true }, { status: 200 });
        throw err;
      }
    }
  } catch (err) {
    console.error("[PUT /api/clips/:clipId] failed:", err);
    return textResponse("storage unavailable", 503);
  }
}


export async function GET(event: APIEvent) {
  const rl = rateLimit(event.request, "clips:get", "relaxed");
  if (rl) return rl;
  const clipId = event.params.clipId;
  const searchParams = new URL(event.request.url).searchParams;
  const projectId = searchParams.get("projectId") ?? "";

  if (!isUuid(clipId) || !isUuid(projectId)) return textResponse("invalid id", 400);

  let access: Awaited<ReturnType<typeof getReadAccess>>;
  try {
    access = await getReadAccess(event.request, projectId);
  } catch (err) {
    console.error("[GET /api/clips/:clipId] DB error:", err);
    return textResponse("internal error", 500);
  }
  if (!access.ok) return textResponse("not found", 404);

  const rangeHeader = event.request.headers.get("range");

  const store = getClipsStore();
  if (!store) {
    const local = await getLocalClip(projectId, clipId);
    if (!local) {
      if (canUseLocalClipStore()) return new Response(null, { status: 204 });
      return textResponse("storage not available", 503);
    }
    return localClipResponse(local, rangeHeader);
  }

  try {
    const key = `${projectId}/${clipId}`;
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) {
      return new Response(null, { status: 204 });
    }

    const metadata = result.metadata as Record<string, string> | null;
    const mime = metadata?.mime ?? "audio/mpeg";

    let fullBuffer: Uint8Array;

    if (metadata?.chunks) {
      const chunks = parseInt(metadata.chunks as string, 10);
      const buffers: Uint8Array[] = [];
      let totalSize = 0;
      for (let i = 0; i < chunks; i++) {
        const c = await store.get(`${projectId}/${clipId}_${i}`, { type: "arrayBuffer" });
        if (c) {
          const arr = new Uint8Array(c as ArrayBuffer);
          buffers.push(arr);
          totalSize += arr.byteLength;
        }
      }
      fullBuffer = new Uint8Array(totalSize);
      let offset = 0;
      for (const b of buffers) { fullBuffer.set(b, offset); offset += b.byteLength; }
    } else {
      fullBuffer = new Uint8Array(result.data as ArrayBuffer);
    }

    const total = fullBuffer.byteLength;
    const range = parseRange(rangeHeader, total);

    if (range) {
      const slice = fullBuffer.slice(range.start, range.end + 1);
      return new Response(slice.buffer, {
        status: 206,
        headers: {
          "Content-Type": mime,
          "Content-Range": `bytes ${range.start}-${range.end}/${total}`,
          "Content-Length": String(slice.byteLength),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    return new Response(fullBuffer.buffer, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(total),
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    warnStorageFallback("GET", err);
    const local = await getLocalClip(projectId, clipId);
    if (local) return localClipResponse(local, rangeHeader);
    if (canUseLocalClipStore()) return new Response(null, { status: 204 });
    console.error("[GET /api/clips/:clipId] storage error:", err);
    return textResponse("storage unavailable", 503);
  }
}


export async function HEAD(event: APIEvent) {
  const clipId = event.params.clipId;
  const searchParams = new URL(event.request.url).searchParams;
  const projectId = searchParams.get("projectId") ?? "";

  if (!isUuid(clipId) || !isUuid(projectId)) return new Response(null, { status: 400 });

  let access: Awaited<ReturnType<typeof getReadAccess>>;
  try {
    access = await getReadAccess(event.request, projectId);
  } catch (err) {
    console.error("[HEAD /api/clips/:clipId] DB error:", err);
    return new Response(null, { status: 500 });
  }
  if (!access.ok) return new Response(null, { status: 404 });

  const store = getClipsStore();
  if (!store) {
    const local = await getLocalClip(projectId, clipId);
    if (!local) return new Response(null, { status: canUseLocalClipStore() ? 204 : 503 });
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": local.mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  try {
    const metaResult = await store.getMetadata(`${projectId}/${clipId}`);
    if (!metaResult) return new Response(null, { status: 204 });
    const metadata = metaResult.metadata as Record<string, string> | null;
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": metadata?.mime ?? "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    warnStorageFallback("HEAD", err);
    const local = await getLocalClip(projectId, clipId);
    if (local) return new Response(null, { status: 200, headers: { "Content-Type": local.mime } });
    if (canUseLocalClipStore()) return new Response(null, { status: 204 });
    console.error("[HEAD /api/clips/:clipId] storage error:", err);
    return new Response(null, { status: 503 });
  }
}


export async function DELETE(event: APIEvent) {
  const rl = rateLimit(event.request, "clips:delete", "strict");
  if (rl) return rl;
  const clipId = event.params.clipId;
  const projectId = new URL(event.request.url).searchParams.get("projectId") ?? "";

  if (!isUuid(clipId) || !isUuid(projectId)) return textResponse("invalid id", 400);

  let access: Awaited<ReturnType<typeof getOwnerAccess>>;
  try {
    access = await getOwnerAccess(event.request, projectId);
  } catch (err) {
    console.error("[DELETE /api/clips/:clipId] DB error:", err);
    return textResponse("internal error", 500);
  }
  if (!access.ok) {
    if (access.reason === "unauthorized") return textResponse("unauthorized", 401);
    if (access.reason === "not-found") return textResponse("not found", 404);
    return textResponse("forbidden", 403);
  }

  const store = getClipsStore();
  if (!store) {
    await deleteLocalClip(projectId, clipId);
    return Response.json({ ok: true }, { status: 200 });
  }

  try {
    const metaResult = await store.getMetadata(`${projectId}/${clipId}`);
    if (metaResult?.metadata?.chunks) {
      const chunks = parseInt(metaResult.metadata.chunks as string, 10);
      for (let i = 0; i < chunks; i++) {
        await store.delete(`${projectId}/${clipId}_${i}`);
      }
    }
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
