// Strategies for turning an assetId → download URL.
// AssetManager takes one of these as its `resolveUrl` option.

import type { AssetId } from "~/lib/audio/types";

/** Static prefix resolver — for dev or any setup where bytes live at
 *  a public URL pattern like  https://cdn.example.com/audio/<assetId>.wav  */
export function publicPrefixResolver(prefix: string, ext = "wav") {
  return (id: AssetId): string => `${prefix.replace(/\/$/, "")}/${id}.${ext}`;
}

/** Signed-URL resolver — calls our own server to mint a short-lived URL
 *  for a private R2/S3 object. Keeps bytes private and rate-limited. */
export function signedUrlResolver(endpoint = "/api/asset/sign") {
  return async (id: AssetId): Promise<string> => {
    const res = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`sign url: ${res.status}`);
    const { url } = (await res.json()) as { url: string };
    return url;
  };
}
