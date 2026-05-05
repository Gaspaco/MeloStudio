// Server-side project CRUD.
import { sql } from "./client";
import { SCHEMA_VERSION, type ProjectDoc } from "~/lib/audio/types";

export interface ProjectListItem {
  id: string;
  name: string;
  bpm: number;
  updatedAt: string;
  trackCount: number;
}

// blank doc for a new project. the id gets set after the INSERT.
export function makeBlankDoc(id: string, name: string): ProjectDoc {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    transport: {
      bpm: 120,
      timeSig: [4, 4],
      playheadSec: 0,
    },
    master: { gainDb: 0 },
    tracks: [],
    assets: [],
  };
}

export async function listProjects(userId: string): Promise<ProjectListItem[]> {
  const rows = await sql`
    SELECT
      id, name, bpm, updated_at,
      COALESCE(jsonb_array_length(data->'tracks'), 0) AS track_count
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 200
  ` as Array<{ id: string; name: string; bpm: number; updated_at: string; track_count: number }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bpm: r.bpm,
    updatedAt: r.updated_at,
    trackCount: r.track_count ?? 0,
  }));
}

export async function getProjectStats(userId: string): Promise<{ studioHours: number }> {
  const rows = await sql`
    SELECT
      COALESCE(
        SUM(EXTRACT(EPOCH FROM (updated_at - created_at))),
        0
      )::float / 3600 AS studio_hours
    FROM projects
    WHERE user_id = ${userId}
  ` as Array<{ studio_hours: number }>;
  return { studioHours: Math.round((rows[0]?.studio_hours ?? 0) * 10) / 10 };
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<ProjectDoc | null> {
  const rows = await sql`
    SELECT data FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
    LIMIT 1
  ` as Array<{ data: ProjectDoc }>;
  return rows[0]?.data ?? null;
}

export async function createProject(
  userId: string,
  name: string,
): Promise<ProjectDoc> {
  // Insert with an empty placeholder, then UPDATE once we have the real id.
  const inserted = await sql`
    INSERT INTO projects (user_id, name, bpm, data, schema_ver)
    VALUES (${userId}, ${name}, 120, '{}'::jsonb, ${SCHEMA_VERSION})
    RETURNING id
  ` as Array<{ id: string }>;
  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("Failed to create project");
  }
  const doc = makeBlankDoc(id, name);
  await sql`
    UPDATE projects SET data = ${JSON.stringify(doc)}::jsonb
    WHERE id = ${id}
  `;
  return doc;
}

// Writes the project doc and appends a version snapshot in one transaction.
// Also updates the name/bpm columns on the row so list queries don't need to read the full doc.
// Caller should debounce — this does no rate limiting.
export async function saveProject(
  userId: string,
  projectId: string,
  doc: ProjectDoc,
): Promise<void> {
  if (doc.id !== projectId) {
    throw new Error("doc.id must match projectId");
  }
  const docJson = JSON.stringify({
    ...doc,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  });

  // one transaction: update doc + snapshot insert
  await sql.transaction([
    sql`
      UPDATE projects
      SET data = ${docJson}::jsonb,
          name = ${doc.name},
          bpm = ${doc.transport.bpm},
          schema_ver = ${SCHEMA_VERSION}
      WHERE id = ${projectId} AND user_id = ${userId}
    `,
    sql`
      INSERT INTO project_versions (project_id, data, schema_ver)
      VALUES (${projectId}, ${docJson}::jsonb, ${SCHEMA_VERSION})
    `,
  ]);
}

export async function deleteProject(
  userId: string,
  projectId: string,
): Promise<void> {
  await sql`
    DELETE FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
  `;
}
