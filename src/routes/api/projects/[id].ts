// GET    /api/projects/:id  → load full ProjectDoc (includes _published metadata)
// PUT    /api/projects/:id  → save full ProjectDoc (body = doc)
// PATCH  /api/projects/:id  → update name or published state, or restore from trash
// DELETE /api/projects/:id  → soft-delete (move to trash, auto-purge after 10 days)
// DELETE /api/projects/:id?permanent=true  → permanently destroy
import type { APIEvent } from "@solidjs/start/server";
import {
  getProject,
  saveProject,
  deleteProject,
  setPublished,
  restoreProject,
  permanentlyDeleteProject,
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

  // Restore from trash
  if (body.restore === true) {
    await restoreProject(userId, id);
    return new Response(null, { status: 204 });
  }

  // Published toggle — only touches the projects row, not the doc
  if (body.published !== undefined) {
    await setPublished(userId, id, Boolean(body.published));
    return new Response(null, { status: 204 });
  }

  const result = await getProject(userId, id);
  if (!result) return new Response("not found", { status: 404 });
  const doc = result.doc;
  if (body.name !== undefined) doc.name = body.name;
  if (body.genre !== undefined) doc.genre = body.genre;
  if (body.description !== undefined) doc.description = body.description;
  if (body.explicit !== undefined) doc.explicit = Boolean(body.explicit);
  if (body.lyrics !== undefined) doc.lyrics = body.lyrics;
  await saveProject(userId, id, doc);
  return new Response(null, { status: 204 });
}

export async function DELETE(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return new Response("unauthorized", { status: 401 });
  const id = event.params.id;
  if (!id) return new Response("missing id", { status: 400 });
  const url = new URL(event.request.url);
  if (url.searchParams.get("permanent") === "true") {
    await permanentlyDeleteProject(userId, id);
  } else {
    await deleteProject(userId, id);
  }
  return new Response(null, { status: 204 });
}
