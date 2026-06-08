import { sql } from "./client";

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const rows = await sql`
    SELECT
      (SELECT COUNT(*) FROM follows WHERE following_id = ${userId})::int AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id  = ${userId})::int AS following
  ` as Array<{ followers: number; following: number }>;
  return { followers: rows[0]?.followers ?? 0, following: rows[0]?.following ?? 0 };
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM follows WHERE follower_id = ${followerId} AND following_id = ${followingId} LIMIT 1
  ` as unknown[];
  return rows.length > 0;
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  await sql`
    INSERT INTO follows (follower_id, following_id)
    VALUES (${followerId}, ${followingId})
    ON CONFLICT DO NOTHING
  `;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await sql`
    DELETE FROM follows WHERE follower_id = ${followerId} AND following_id = ${followingId}
  `;
}
