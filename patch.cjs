const fs = require('fs');

let remoteClips = fs.readFileSync('src/lib/remoteClips.ts', 'utf8');

remoteClips = remoteClips.replace(
  'export const MAX_REMOTE_CLIP_UPLOAD_BYTES = 4_000_000;',
  'export const MAX_REMOTE_CLIP_UPLOAD_BYTES = 50 * 1024 * 1024;\nexport const CHUNK_SIZE = 3 * 1024 * 1024;'
);

const uploadLogic = `
  if (blob.size <= CHUNK_SIZE) {
    const res = await apiFetch(remoteUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });

    if (!res.ok) {
      const error = await res.text().catch(() => "");
      return { stored: false, status: res.status, error };
    }

    const body = await res.json().catch(() => ({})) as { stored?: boolean; error?: string };
    return {
      remoteUrl: body.stored ? remoteUrl : undefined,
      stored: body.stored === true,
      status: res.status,
      error: body.error,
    };
  }

  const chunks = Math.ceil(blob.size / CHUNK_SIZE);
  let status = 200;
  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, blob.size);
    const chunkBlob = blob.slice(start, end, contentType);
    const chunkRes = await apiFetch(\`\${remoteUrl}&chunk=\${i}\`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: chunkBlob,
    });
    if (!chunkRes.ok) {
      const error = await chunkRes.text().catch(() => "");
      return { stored: false, status: chunkRes.status, error };
    }
  }

  const commitRes = await apiFetch(\`\${remoteUrl}&chunks=\${chunks}\`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Blob([""], { type: contentType }),
  });

  if (!commitRes.ok) {
    const error = await commitRes.text().catch(() => "");
    return { stored: false, status: commitRes.status, error };
  }

  const body = await commitRes.json().catch(() => ({})) as { stored?: boolean; error?: string };
  return {
    remoteUrl: body.stored ? remoteUrl : undefined,
    stored: body.stored === true,
    status: commitRes.status,
    error: body.error,
  };
`;

remoteClips = remoteClips.replace(
  /const remoteUrl = remoteClipUrl\(projectId, clipId\);[\s\S]*?(?=export function remoteClipUploadErrorMessage)/,
  `const remoteUrl = remoteClipUrl(projectId, clipId);\n${uploadLogic}\n}\n\n`
);

fs.writeFileSync('src/lib/remoteClips.ts', remoteClips);
