// GET /api/user/:id/pfp — returns the user's profile picture.
// Checks neon_auth.user first (Neon Auth / UUID IDs), then public.user (Better Auth).
// Serves data: URLs as image bytes, redirects http URLs.
import type { APIEvent } from "@solidjs/start/server";
import { sql } from "~/lib/db/client";
import { isSafeRemoteUrl, textResponse } from "../../_utils";

const MAX_DATA_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_MIME_RE = /^image\/(avif|gif|jpeg|jpg|png|webp)$/i;

export async function GET(event: APIEvent) {
  const id = event.params.id;
  if (!id || id.length > 128) return textResponse("invalid id", 400);

  let image: string | null = null;

  // Neon Auth users (UUID-format IDs)
  try {
    const rows = await sql`SELECT image FROM neon_auth."user" WHERE id = ${id} LIMIT 1` as Array<{ image: string | null }>;
    image = rows[0]?.image ?? null;
  } catch { /* ignore */ }

  // Better Auth users (fallback)
  if (!image) {
    try {
      const rows = await sql`SELECT image FROM public."user" WHERE id = ${id} LIMIT 1` as Array<{ image: string | null }>;
      image = rows[0]?.image ?? null;
    } catch { /* ignore */ }
  }

  if (!image) return new Response(null, { status: 404 });

  // data: URL — decode and serve directly
  if (image.startsWith("data:")) {
    const comma = image.indexOf(",");
    if (comma < 0) return textResponse("invalid image", 422);
    const meta = image.slice(0, comma);
    const b64 = image.slice(comma + 1);
    const contentType = (meta.split(";")[0] ?? "").replace("data:", "") || "image/jpeg";
    if (!IMAGE_MIME_RE.test(contentType)) return textResponse("unsupported image", 415);
    let bytes: Uint8Array;
    try {
      const binary = atob(b64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch {
      return textResponse("invalid image", 422);
    }
    if (bytes.byteLength > MAX_DATA_IMAGE_BYTES) return textResponse("image too large", 413);
    return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: contentType }), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // http URL — redirect
  if (!isSafeRemoteUrl(image)) return textResponse("image url is not allowed", 422);
  return Response.redirect(image, 302);
}
