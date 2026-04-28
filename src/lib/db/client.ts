// Server-side only. Never import from a client component.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL env var is required");
}

/**
 * Tagged-template SQL client.
 *   const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
 * Uses HTTP fetch — works in Vercel/edge/Node alike.
 */
export const sql = neon(url);
