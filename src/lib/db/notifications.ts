import { sql } from "./client";

export interface Notification {
  id: string;
  type: string;
  actorId: string;
  projectId: string | null;
  commentId: string | null;
  read: boolean;
  createdAt: string;
}

export async function createNotification(
  userId: string,
  type: string,
  actorId: string,
  projectId?: string,
  commentId?: string,
): Promise<void> {
  if (userId === actorId) return;
  await sql`
    INSERT INTO notifications (user_id, type, actor_id, project_id, comment_id)
    VALUES (${userId}, ${type}, ${actorId}, ${projectId ?? null}, ${commentId ?? null})
  `;
}

export async function listNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const rows = await sql`
    SELECT id, type, actor_id, project_id, comment_id, read, created_at
    FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  ` as Array<{
    id: string; type: string; actor_id: string; project_id: string | null;
    comment_id: string | null; read: boolean; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    actorId: r.actor_id,
    projectId: r.project_id,
    commentId: r.comment_id,
    read: r.read,
    createdAt: r.created_at,
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM notifications
    WHERE user_id = ${userId} AND read = FALSE
  ` as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  await sql`
    UPDATE notifications SET read = TRUE
    WHERE id = ${notificationId} AND user_id = ${userId}
  `;
}

export async function markAllRead(userId: string): Promise<void> {
  await sql`
    UPDATE notifications SET read = TRUE
    WHERE user_id = ${userId} AND read = FALSE
  `;
}
