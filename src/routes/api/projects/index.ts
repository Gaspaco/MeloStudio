// GET  /api/projects           - list the current user's active projects
// GET  /api/projects?deleted=true - list trashed projects (auto-purges >10 days)
// POST /api/projects            - create a new project { name }
import type { APIEvent } from "@solidjs/start/server";
import { listProjects, listDeletedProjects, createProject } from "~/lib/db/projects";
import { requireUserId } from "~/lib/auth-server";

export async function GET(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const url = new URL(event.request.url);
  if (url.searchParams.get("deleted") === "true") {
    const items = await listDeletedProjects(userId);
    return Response.json(items);
  }
  const items = await listProjects(userId);
  return Response.json(items);
}

export async function POST(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const body = await event.request.json().catch(() => ({}));
  const name = (body?.name ?? "Untitled Project").toString().slice(0, 100);
  const doc = await createProject(userId, name);
  return Response.json(doc, { status: 201 });
}
