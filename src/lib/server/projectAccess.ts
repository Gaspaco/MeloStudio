import { requireUserId } from "~/lib/auth-server";
import { sql } from "~/lib/db/client";

interface ProjectRow { user_id: string; published: boolean }

async function getProjectRow(projectId: string): Promise<ProjectRow | null> {
  const rows = await sql`
    SELECT user_id, published FROM projects
    WHERE id = ${projectId} AND deleted_at IS NULL
    LIMIT 1
  ` as ProjectRow[];
  return rows[0] ?? null;
}

export type ReadAccessResult =
  | { ok: false; reason: "not-found" }
  | { ok: true; ownerId: string; published: boolean; isOwner: boolean };

export async function getReadAccess(
  request: Request,
  projectId: string,
): Promise<ReadAccessResult> {
  const row = await getProjectRow(projectId);
  if (!row) return { ok: false, reason: "not-found" };
  if (row.published) {
    // Public project — no auth needed. Caller can still check isOwner if it wants to add owner-only extras.
    const userId = await requireUserId(request).catch(() => null);
    return { ok: true, ownerId: row.user_id, published: true, isOwner: userId === row.user_id };
  }
  const userId = await requireUserId(request);
  if (!userId || userId !== row.user_id) return { ok: false, reason: "not-found" };
  return { ok: true, ownerId: row.user_id, published: false, isOwner: true };
}

export type OwnerAccessResult =
  | { ok: false; reason: "unauthorized" | "not-found" | "forbidden" }
  | { ok: true; userId: string; published: boolean };

export async function getOwnerAccess(
  request: Request,
  projectId: string,
): Promise<OwnerAccessResult> {
  const userId = await requireUserId(request);
  if (!userId) return { ok: false, reason: "unauthorized" };
  const row = await getProjectRow(projectId);
  if (!row) return { ok: false, reason: "not-found" };
  if (row.user_id !== userId) return { ok: false, reason: "forbidden" };
  return { ok: true, userId, published: row.published };
}
