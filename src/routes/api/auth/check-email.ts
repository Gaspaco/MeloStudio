import type { APIEvent } from "@solidjs/start/server";
import { sql } from "~/lib/db/client";

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;

    if (!email) {
      return new Response(JSON.stringify({ exists: false }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rows = await sql`
      SELECT 1 FROM "user" WHERE LOWER(email) = ${email} LIMIT 1
    ` as unknown[];

    return new Response(JSON.stringify({ exists: rows.length > 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ exists: false }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
