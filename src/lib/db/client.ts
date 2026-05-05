// Server-side only — never import from a client component.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL env var is required");
}

// Tagged-template SQL client. Runs over HTTP so it works in Vercel edge runtimes.
//   const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
export const sql = neon(url);
