// Server-side project CRUD.
import { sql } from "./client";
import { SCHEMA_VERSION, type ProjectDoc } from "~/lib/audio/types";
import { getProjectDurationSec, getProjectTrackCount } from "~/lib/audio/projectTimeline";

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`);
    this.name = "ProjectNotFoundError";
  }
}

function cleanProjectName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "") : "";
  return (name || "Untitled Project").slice(0, 100);
}

function clampBpm(value: unknown): number {
  const bpm = typeof value === "number" && Number.isFinite(value) ? value : 120;
  return Math.min(300, Math.max(20, bpm));
}

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
    WHERE user_id = ${userId} AND deleted_at IS NULL
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
  // Group save events (project_versions rows) into sessions.
  // A new session starts when there is a gap of more than 30 minutes since the last save.
  // Each session is credited (last_save - first_save) + 5 minutes minimum.
  // This avoids the old bug where (updated_at - created_at) counted calendar days as studio time.
  const rows = await sql`
    WITH saves AS (
      SELECT pv.created_at
      FROM project_versions pv
      JOIN projects p ON pv.project_id = p.id
      WHERE p.user_id = ${userId}
    ),
    gaps AS (
      SELECT
        created_at,
        CASE
          WHEN created_at - LAG(created_at) OVER (ORDER BY created_at) > INTERVAL '30 minutes'
            OR LAG(created_at) OVER (ORDER BY created_at) IS NULL
          THEN 1 ELSE 0
        END AS new_session
      FROM saves
    ),
    sessions AS (
      SELECT
        SUM(new_session) OVER (ORDER BY created_at ROWS UNBOUNDED PRECEDING) AS session_id,
        created_at
      FROM gaps
    ),
    session_times AS (
      SELECT
        EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) + 300 AS duration_secs
      FROM sessions
      GROUP BY session_id
    )
    SELECT COALESCE(SUM(duration_secs) / 3600.0, 0)::float AS studio_hours
    FROM session_times
  ` as Array<{ studio_hours: number }>;
  return { studioHours: Math.round((rows[0]?.studio_hours ?? 0) * 10) / 10 };
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<{ doc: ProjectDoc; published: boolean } | null> {
  const rows = await sql`
    SELECT data, published FROM projects
    WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
    LIMIT 1
  ` as Array<{ data: ProjectDoc; published: boolean }>;
  if (!rows[0]) return null;
  return { doc: rows[0].data, published: rows[0].published ?? false };
}

export async function setPublished(
  userId: string,
  projectId: string,
  published: boolean,
): Promise<boolean> {
  const rows = await sql`
    UPDATE projects SET published = ${published}
    WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING id
  ` as Array<{ id: string }>;
  return rows.length > 0;
}

export interface PublicProjectView {
  id: string;
  name: string;
  bpm: number;
  key: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
  ownerId?: string;
  mixUrl?: string;
  durationSec?: number;
  genre?: string;
  description?: string;
  explicit?: boolean;
  lyrics?: string;
}

export async function getPublicProject(projectId: string): Promise<PublicProjectView | null> {
  const rows = await sql`
    SELECT id, name, bpm, created_at, updated_at, data, user_id FROM projects
    WHERE id = ${projectId} AND published = true
    LIMIT 1
  ` as Array<{ id: string; name: string; bpm: number; created_at: string; updated_at: string; data: ProjectDoc; user_id: string }>;
  if (!rows[0]) return null;
  const doc = rows[0].data;
  const bpm = rows[0].bpm || doc.transport?.bpm || 120;

  return {
    id: rows[0].id,
    name: rows[0].name,
    bpm,
    key: doc.musicalKey ?? "—",
    trackCount: getProjectTrackCount(doc),
    createdAt: rows[0].created_at ?? doc.createdAt,
    updatedAt: rows[0].updated_at,
    ownerId: rows[0].user_id,
    mixUrl: doc.mixUrl,
    durationSec: getProjectDurationSec(doc, bpm),
    genre: doc.genre,
    description: doc.description,
    explicit: doc.explicit,
    lyrics: doc.lyrics,
  };
}

/** Returns the raw doc for a *published* project — used by the transcribe endpoint to scan clips. */
export async function getPublicProjectDoc(projectId: string): Promise<ProjectDoc | null> {
  const rows = await sql`
    SELECT data FROM projects
    WHERE id = ${projectId} AND published = true
    LIMIT 1
  ` as Array<{ data: ProjectDoc }>;
  return rows[0]?.data ?? null;
}

export async function createProject(
  userId: string,
  name: string,
): Promise<ProjectDoc> {
  const safeName = cleanProjectName(name);
  // Insert with an empty placeholder, then UPDATE once we have the real id.
  const inserted = await sql`
    INSERT INTO projects (user_id, name, bpm, data, schema_ver)
    VALUES (${userId}, ${safeName}, 120, '{}'::jsonb, ${SCHEMA_VERSION})
    RETURNING id
  ` as Array<{ id: string }>;
  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("Failed to create project");
  }
  const doc = makeBlankDoc(id, safeName);
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
  const name = cleanProjectName(doc.name);
  const bpm = clampBpm(doc.transport?.bpm);
  const docJson = JSON.stringify({
    ...doc,
    name,
    transport: {
      ...doc.transport,
      bpm,
    },
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  });

  // Update the main project row first — this is the critical operation.
  const updated = await sql`
    UPDATE projects
    SET data = ${docJson}::jsonb,
        name = ${name},
        bpm = ${bpm},
        schema_ver = ${SCHEMA_VERSION}
    WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING id
  ` as Array<{ id: string }>;
  if (!updated[0]) throw new ProjectNotFoundError(projectId);

  // Append a version snapshot — best-effort, never fails the save.
  try {
    await sql`
      INSERT INTO project_versions (project_id, data, schema_ver)
      VALUES (${projectId}, ${docJson}::jsonb, ${SCHEMA_VERSION})
    `;
  } catch (err) {
    // Non-critical: version history is optional. Log but don't throw.
    console.warn("[saveProject] version snapshot insert failed (non-fatal)", err);
  }
}

export async function deleteProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  // Soft-delete: move to trash. Auto-purged after 10 days.
  const rows = await sql`
    UPDATE projects
    SET deleted_at = now()
    WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING id
  ` as Array<{ id: string }>;
  return rows.length > 0;
}

export interface DeletedProjectListItem {
  id: string;
  name: string;
  bpm: number;
  deletedAt: string;
  expiresAt: string;
  trackCount: number;
}

export async function listDeletedProjects(userId: string): Promise<DeletedProjectListItem[]> {
  // Auto-purge anything older than 10 days first
  await sql`
    DELETE FROM projects
    WHERE user_id = ${userId}
      AND deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '10 days'
  `;

  const rows = await sql`
    SELECT
      id, name, bpm, deleted_at,
      deleted_at + INTERVAL '10 days' AS expires_at,
      COALESCE(jsonb_array_length(data->'tracks'), 0) AS track_count
    FROM projects
    WHERE user_id = ${userId} AND deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  ` as Array<{ id: string; name: string; bpm: number; deleted_at: string; expires_at: string; track_count: number }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bpm: r.bpm,
    deletedAt: r.deleted_at,
    expiresAt: r.expires_at,
    trackCount: r.track_count ?? 0,
  }));
}

export async function restoreProject(userId: string, projectId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE projects
    SET deleted_at = NULL
    WHERE id = ${projectId} AND user_id = ${userId}
    RETURNING id
  ` as Array<{ id: string }>;
  return rows.length > 0;
}

export async function permanentlyDeleteProject(userId: string, projectId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
    RETURNING id
  ` as Array<{ id: string }>;
  return rows.length > 0;
}
