// URL resolvers for asset ids. AssetManager takes one as its resolveUrl option.

import type { AssetId } from "~/lib/audio/types";

// static prefix resolver — for dev or any setup where files are at a public URL
export function publicPrefixResolver(prefix: string, ext = "wav") {
  return (id: AssetId): string => `${prefix.replace(/\/$/, "")}/${id}.${ext}`;
}

// signed-URL resolver — hits our server to get a short-lived URL for a private object
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
