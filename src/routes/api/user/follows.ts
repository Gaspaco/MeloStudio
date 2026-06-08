import type { APIEvent } from "@solidjs/start/server";
import { requireUserId } from "~/lib/auth-server";
import { getFollowCounts } from "~/lib/db/follows";

export async function GET(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const counts = await getFollowCounts(userId);
  return new Response(JSON.stringify(counts), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
