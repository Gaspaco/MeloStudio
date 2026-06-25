import { sql } from "./client";
import { createNotification } from "./notifications";

function getProjectOwner(projectId: string): Promise<string | null> {
  return sql`SELECT user_id FROM projects WHERE id = ${projectId} LIMIT 1`
    .then((rows) => (rows as Array<any>)[0]?.user_id ?? null)
    .catch(() => null);
}

// ── Likes ────────────────────────────────────────────────────────────────

export async function likeProject(userId: string, projectId: string): Promise<void> {
  await sql`
    INSERT INTO project_likes (user_id, project_id)
    VALUES (${userId}, ${projectId})
    ON CONFLICT DO NOTHING
  `;
  const ownerId = await getProjectOwner(projectId);
  if (ownerId) void createNotification(ownerId, "like", userId, projectId).catch(() => {});
}

export async function unlikeProject(userId: string, projectId: string): Promise<void> {
  await sql`
    DELETE FROM project_likes
    WHERE user_id = ${userId} AND project_id = ${projectId}
  `;
}

export async function hasLiked(userId: string, projectId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM project_likes
    WHERE user_id = ${userId} AND project_id = ${projectId}
    LIMIT 1
  ` as Array<Record<string, unknown>>;
  return rows.length > 0;
}

export async function getLikeCount(projectId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM project_likes
    WHERE project_id = ${projectId}
  ` as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

// ── Comments ─────────────────────────────────────────────────────────────

export interface ProjectComment {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
}

export async function addComment(
  userId: string,
  projectId: string,
  body: string,
): Promise<ProjectComment> {
  const rows = await sql`
    INSERT INTO project_comments (project_id, user_id, body)
    VALUES (${projectId}, ${userId}, ${body})
    RETURNING id, user_id, body, created_at
  ` as Array<{ id: string; user_id: string; body: string; created_at: string }>;
  const r = rows[0];
  if (!r) throw new Error("Failed to insert comment");
  const ownerId = await getProjectOwner(projectId);
  if (ownerId) void createNotification(ownerId, "comment", userId, projectId, r.id).catch(() => {});
  return { id: r.id, userId: r.user_id, body: r.body, createdAt: r.created_at };
}

export async function deleteComment(userId: string, commentId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM project_comments
    WHERE id = ${commentId} AND user_id = ${userId}
    RETURNING id
  ` as Array<{ id: string }>;
  return rows.length > 0;
}

export async function listComments(projectId: string, limit = 50): Promise<ProjectComment[]> {
  const rows = await sql`
    SELECT id, user_id, body, created_at
    FROM project_comments
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  ` as Array<{ id: string; user_id: string; body: string; created_at: string }>;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    body: r.body,
    createdAt: r.created_at,
  }));
}
