// Server-side project CRUD. Imports from "~/lib/audio/types" for the doc shape.
import { sql } from "./client";
import { SCHEMA_VERSION, type ProjectDoc } from "~/lib/audio/types";

export interface ProjectListItem {
  id: string;
  name: string;
  bpm: number;
  updatedAt: string;
}

/** A starter doc for brand-new projects. */
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
    SELECT id, name, bpm, updated_at
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 200
  ` as Array<{ id: string; name: string; bpm: number; updated_at: string }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bpm: r.bpm,
    updatedAt: r.updated_at,
  }));
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
  // Insert with a placeholder doc, then update with the real id baked in.
  const inserted = await sql`
    INSERT INTO projects (user_id, name, bpm, data, schema_ver)
    VALUES (${userId}, ${name}, 120, '{}'::jsonb, ${SCHEMA_VERSION})
    RETURNING id
  ` as Array<{ id: string }>;
  const id = inserted[0].id;
  const doc = makeBlankDoc(id, name);
  await sql`
    UPDATE projects SET data = ${JSON.stringify(doc)}::jsonb
    WHERE id = ${id}
  `;
  return doc;
}

/**
 * Save a full project doc.
 * - Bumps name + bpm denormalized columns from the doc.
 * - Appends a snapshot to project_versions.
 * - Caller is expected to throttle/debounce client-side.
 */
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

  // Single transaction: update + insert version
  // (neon HTTP driver supports `sql.transaction([...])` for batching)
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
