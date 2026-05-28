import { apiFetch } from "./api";

export type RemoteClipUploadResult = {
  remoteUrl?: string;
  stored: boolean;
  status: number;
  error?: string;
};

export const remoteClipUrl = (projectId: string, clipId: string) =>
  `/api/clips/${encodeURIComponent(clipId)}?projectId=${encodeURIComponent(projectId)}`;

export async function uploadRemoteClip(
  projectId: string,
  clipId: string,
  blob: Blob,
  contentType = blob.type || "audio/mpeg",
): Promise<RemoteClipUploadResult> {
  const remoteUrl = remoteClipUrl(projectId, clipId);
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

export function remoteClipUploadErrorMessage(result: RemoteClipUploadResult): string {
  if (result.status === 401) return "Sign in again to upload large audio.";
  if (result.status === 403) return "This project does not allow large audio uploads from this account.";
  if (result.status === 404) return "Large audio could not upload because the project was not found.";
  if (result.status === 413) return "Large audio is over the 50 MB upload limit.";
  if (result.status === 415) return "This audio format cannot be uploaded yet.";
  if (result.status === 500 || result.status === 503 || result.status === 200) {
    return "Large audio could not upload to server storage. It will only play from this browser for now.";
  }
  return `Large audio could not upload (${result.status}). It will only play from this browser for now.`;
}

export async function deleteRemoteClip(projectId: string, clipId: string): Promise<void> {
  await apiFetch(remoteClipUrl(projectId, clipId), { method: "DELETE" });
}