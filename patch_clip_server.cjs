const fs = require('fs');

let clipApi = fs.readFileSync('src/routes/api/clips/[clipId].ts', 'utf8');

clipApi = clipApi.replace(
  'import { mkdir, readFile, rm, writeFile } from "node:fs/promises";',
  'import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";'
);

const newDeleteLocalClip = `
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
        await rm(localClipPath(projectId, \`\${clipId}_\${i}\`), { force: true });
      }
    }
  }
}
`;

clipApi = clipApi.replace(
  /async function deleteLocalClip[\s\S]*?(?=async function getProjectOwner)/,
  newDeleteLocalClip + '\n'
);

const newGetLocalClip = `
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
        const b = await readFile(localClipPath(projectId, \`\${clipId}_\${i}\`));
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
`;

clipApi = clipApi.replace(
  /async function getLocalClip[\s\S]*?(?=function localClipResponse)/,
  newGetLocalClip + '\n'
);

const newPut = `
export async function PUT(event: APIEvent) {
  const clipId = event.params.clipId;
  const searchParams = new URL(event.request.url).searchParams;
  const projectId = searchParams.get("projectId") ?? "";
  const chunkStr = searchParams.get("chunk");
  const chunksStr = searchParams.get("chunks");

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
  if (chunksStr === null && contentType && !ALLOWED_AUDIO_TYPES.has(contentType) && contentType !== "application/octet-stream") {
    return textResponse("unsupported media type", 415);
  }

  try {
    const body = await event.request.arrayBuffer();
    if (chunksStr === null && body.byteLength === 0) return textResponse("empty body", 400);
    if (body.byteLength > MAX_CLIP_BYTES) return textResponse("file too large", 413);

    const store = getClipsStore();

    if (chunkStr !== null) {
      const key = \`\${projectId}/\${clipId}_\${chunkStr}\`;
      if (!store) {
        const dir = join(LOCAL_CLIP_ROOT, projectId);
        await mkdir(dir, { recursive: true });
        await writeFile(localClipPath(projectId, \`\${clipId}_\${chunkStr}\`), new Uint8Array(body));
        return Response.json({ ok: true, stored: true, local: true }, { status: 200 });
      }
      try {
        await store.set(key, body);
        return Response.json({ ok: true, stored: true }, { status: 200 });
      } catch (err) {
        warnStorageFallback("PUT_chunk", err);
        const dir = join(LOCAL_CLIP_ROOT, projectId);
        await mkdir(dir, { recursive: true });
        await writeFile(localClipPath(projectId, \`\${clipId}_\${chunkStr}\`), new Uint8Array(body));
        return Response.json({ ok: true, stored: true, local: true }, { status: 200 });
      }
    } else if (chunksStr !== null) {
      const key = \`\${projectId}/\${clipId}\`;
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
      const key = \`\${projectId}/\${clipId}\`;
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
`;

clipApi = clipApi.replace(
  /export async function PUT[\s\S]*?(?=export async function GET)/,
  newPut + '\n'
);

const newGet = `
export async function GET(event: APIEvent) {
  const clipId = event.params.clipId;
  const searchParams = new URL(event.request.url).searchParams;
  const projectId = searchParams.get("projectId") ?? "";
  const optional = searchParams.get("optional") === "1";

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
    if (!local) {
      if (optional && canUseLocalClipStore()) return new Response(null, { status: 204 });
      return textResponse(canUseLocalClipStore() ? "clip not found" : "storage not available", canUseLocalClipStore() ? 404 : 503);
    }
    return localClipResponse(local);
  }

  try {
    const key = \`\${projectId}/\${clipId}\`;
    const result = await store.getWithMetadata(key, { type: "stream" });
    if (!result) {
      if (optional) return new Response(null, { status: 204 });
      return textResponse("clip not found", 404);
    }

    const metadata = result.metadata as Record<string, string> | null;
    const mime = metadata?.mime ?? "audio/mpeg";
    
    let streamBody: BodyInit = result.data as BodyInit;

    if (metadata?.chunks) {
      const chunks = parseInt(metadata.chunks as string, 10);
      streamBody = new ReadableStream({
        async start(controller) {
          try {
            for (let i = 0; i < chunks; i++) {
              const c = await store.get(\`\${projectId}/\${clipId}_\${i}\`, { type: "arrayBuffer" });
              if (c) controller.enqueue(new Uint8Array(c as ArrayBuffer));
            }
            controller.close();
          } catch(e) { controller.error(e); }
        }
      });
    }

    return new Response(streamBody, {
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
    if (optional && canUseLocalClipStore()) return new Response(null, { status: 204 });
    if (canUseLocalClipStore()) return textResponse("clip not found", 404);
    console.error("[GET /api/clips/:clipId] storage error:", err);
    return textResponse("storage unavailable", 503);
  }
}
`;

clipApi = clipApi.replace(
  /export async function GET[\s\S]*?(?=export async function DELETE)/,
  newGet + '\n'
);

const newDelete = `
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
    const metaResult = await store.getMetadata(\`\${projectId}/\${clipId}\`);
    if (metaResult?.metadata?.chunks) {
      const chunks = parseInt(metaResult.metadata.chunks as string, 10);
      for (let i = 0; i < chunks; i++) {
        await store.delete(\`\${projectId}/\${clipId}_\${i}\`);
      }
    }
    await store.delete(\`\${projectId}/\${clipId}\`);
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
`;

clipApi = clipApi.replace(
  /export async function DELETE[\s\S]*$/,
  newDelete
);

fs.writeFileSync('src/routes/api/clips/[clipId].ts', clipApi);
