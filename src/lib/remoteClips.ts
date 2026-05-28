import { apiFetch } from "./api";

export type RemoteClipUploadResult = {
  remoteUrl?: string;
  stored: boolean;
  status: number;
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

  if (!res.ok) return { stored: false, status: res.status };

  const body = await res.json().catch(() => ({})) as { stored?: boolean };
  return {
    remoteUrl: body.stored ? remoteUrl : undefined,
    stored: body.stored === true,
    status: res.status,
  };
}

export async function deleteRemoteClip(projectId: string, clipId: string): Promise<void> {
  await apiFetch(remoteClipUrl(projectId, clipId), { method: "DELETE" });
}