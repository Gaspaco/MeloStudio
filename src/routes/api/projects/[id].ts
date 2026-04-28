// GET    /api/projects/:id  → load full ProjectDoc
// PUT    /api/projects/:id  → save full ProjectDoc (body = doc)
// DELETE /api/projects/:id  → remove project
import type { APIEvent } from "@solidjs/start/server";
import {
  getProject,
  saveProject,
  deleteProject,
} from "~/lib/db/projects";
import type { ProjectDoc } from "~/lib/audio/types";
import { requireUserId } from "~/lib/auth-server";

export async function GET(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const id = event.params.id;
  const doc = await getProject(userId, id);
  if (!doc) return new Response("not found", { status: 404 });
  return Response.json(doc);
}

export async function PUT(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const id = event.params.id;
  const doc = (await event.request.json()) as ProjectDoc;
  if (!doc || typeof doc !== "object" || doc.id !== id) {
    return new Response("bad payload", { status: 400 });
  }
  await saveProject(userId, id, doc);
  return new Response(null, { status: 204 });
}

export async function DELETE(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  await deleteProject(userId, event.params.id);
  return new Response(null, { status: 204 });
}
