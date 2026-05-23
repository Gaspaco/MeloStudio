// GET /api/user/:id/pfp — returns the user's profile picture.
// Checks neon_auth.user first (Neon Auth / UUID IDs), then public.user (Better Auth).
// Serves data: URLs as image bytes, redirects http URLs.
import type { APIEvent } from "@solidjs/start/server";
import { sql } from "~/lib/db/client";

export async function GET(event: APIEvent) {
  const id = event.params.id;
  if (!id) return new Response(null, { status: 400 });

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
    const meta = image.slice(0, comma);
    const b64 = image.slice(comma + 1);
    const contentType = (meta.split(";")[0] ?? "").replace("data:", "") || "image/jpeg";
    const buffer = Buffer.from(b64, "base64");
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // http URL — redirect
  return Response.redirect(image, 302);
}
