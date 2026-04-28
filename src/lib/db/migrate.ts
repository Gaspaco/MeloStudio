// Standalone migration runner. Run with: bun run db:migrate
// Uses a single WebSocket connection so the whole DDL runs atomically.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

// In Node we need to give the driver a WebSocket implementation.
// @ts-expect-error - ws shape matches what neon expects
neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const ddl = readFileSync(join(here, "schema.sql"), "utf8");

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  console.log("Running schema.sql in one transaction…");
  await client.query("BEGIN");
  await client.query(ddl);
  await client.query("COMMIT");
  console.log("Migration complete.");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
