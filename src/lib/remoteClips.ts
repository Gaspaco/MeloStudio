import { apiFetch, clipUrl } from "./api";

export type RemoteClipUploadResult = {
  remoteUrl?: string;
  stored: boolean;
  status: number;
  error?: string;
};

export const MAX_REMOTE_CLIP_UPLOAD_BYTES = 50 * 1024 * 1024;
export const CHUNK_SIZE = 3 * 1024 * 1024;

// Re-export the canonical URL builder from api.ts — the single source of truth for clip URL shapes
export { clipUrl as remoteClipUrl } from "./api";

export async function uploadRemoteClip(
  projectId: string,
  clipId: string,
  blob: Blob,
  contentType = blob.type || "audio/mpeg",
): Promise<RemoteClipUploadResult> {
  if (blob.size > MAX_REMOTE_CLIP_UPLOAD_BYTES) {
    return {
      stored: false,
      status: 413,
      error: "Clip is larger than Netlify Function binary upload limits.",
    };
  }

  const remoteUrl = clipUrl(projectId, clipId);

  // Single PUT for small clips; chunked PUT + commit for larger ones to stay under serverless function body limits
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
    const chunkRes = await apiFetch(`${remoteUrl}&chunk=${i}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: chunkBlob,
    });
    if (!chunkRes.ok) {
      const error = await chunkRes.text().catch(() => "");
      return { stored: false, status: chunkRes.status, error };
    }
  }

  const commitRes = await apiFetch(`${remoteUrl}&chunks=${chunks}`, {
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

}

export function remoteClipUploadErrorMessage(result: RemoteClipUploadResult): string {
  if (result.status === 401) return "Sign in again to upload large audio.";
  if (result.status === 403) return "This project does not allow large audio uploads from this account.";
  if (result.status === 404) return "Large audio could not upload because the project was not found.";
  if (result.status === 413) return "This audio file is too large for server upload. It will only play from this browser for now.";
  if (result.status === 415) return "This audio format cannot be uploaded yet.";
  if (result.status === 500 || result.status === 503 || result.status === 200) {
    return "Large audio could not upload to server storage. It will only play from this browser for now.";
  }
  return `Large audio could not upload (${result.status}). It will only play from this browser for now.`;
}

export async function deleteRemoteClip(projectId: string, clipId: string): Promise<void> {
  await apiFetch(clipUrl(projectId, clipId), { method: "DELETE" });
}