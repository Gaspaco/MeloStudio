// GET    /api/projects/:id  → load full ProjectDoc (includes _published metadata)
// PUT    /api/projects/:id  → save full ProjectDoc (body = doc)
// PATCH  /api/projects/:id  → update name or published state
// DELETE /api/projects/:id  → remove project
import type { APIEvent } from "@solidjs/start/server";
import {
  getProject,
  saveProject,
  deleteProject,
  setPublished,
} from "~/lib/db/projects";
import type { ProjectDoc } from "~/lib/audio/types";
import { requireUserId } from "~/lib/auth-server";

export async function GET(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const id = event.params.id;
  if (!id) return new Response("missing id", { status: 400 });
  const result = await getProject(userId, id);
  if (!result) return new Response("not found", { status: 404 });
  // Embed published flag as _published — not part of ProjectDoc schema
  return Response.json({ ...result.doc, _published: result.published });
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

  // Published toggle — only touches the projects row, not the doc
  if (body.published !== undefined) {
    await setPublished(userId, id, Boolean(body.published));
    return new Response(null, { status: 204 });
  }

  const result = await getProject(userId, id);
  if (!result) return new Response("not found", { status: 404 });
  const doc = result.doc;
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
