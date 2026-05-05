// GET    /api/projects/:id  - load a project by id
// PUT    /api/projects/:id  - save (body = ProjectDoc)
// DELETE /api/projects/:id  - delete it
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
  if (!id) return new Response("missing id", { status: 400 });
  const doc = await getProject(userId, id);
  if (!doc) return new Response("not found", { status: 404 });
  return Response.json(doc);
}

export async function PUT(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const id = event.params.id;
  if (!id) return new Response("missing id", { status: 400 });
  const doc = (await event.request.json()) as ProjectDoc;
  if (!doc || typeof doc !== "object" || doc.id !== id) {
    return new Response("bad payload", { status: 400 });
  }
  await saveProject(userId, id, doc);
  return new Response(null, { status: 204 });
}

export async function PATCH(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const id = event.params.id;
  if (!id) return new Response("missing id", { status: 400 });
  const body = await event.request.json();
  const doc = await getProject(userId, id);
  if (!doc) return new Response("not found", { status: 404 });
  if (body.name !== undefined) doc.name = body.name;
  await saveProject(userId, id, doc);
  return new Response(null, { status: 204 });
}

export async function DELETE(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const id = event.params.id;
  if (!id) return new Response("missing id", { status: 400 });
  await deleteProject(userId, id);
  return new Response(null, { status: 204 });
}
