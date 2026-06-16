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
  ProjectNotFoundError,
} from "~/lib/db/projects";
import type { ProjectDoc } from "~/lib/audio/types";
import { sql } from "~/lib/db/client";
import { requireUserId } from "~/lib/auth-server";
import { rateLimit } from "~/lib/server/rateLimit";
import {
  cleanOptionalString,
  cleanString,
  isPlainObject,
  isUuid,
  parseBoolean,
  readJsonObject,
  textResponse,
} from "../_utils";

function isProjectDocPayload(value: unknown, id: string): value is ProjectDoc {
  return isPlainObject(value)
    && value.id === id
    && typeof value.name === "string"
    && isPlainObject(value.transport)
    && typeof value.transport.bpm === "number"
    && Array.isArray(value.tracks)
    && Array.isArray(value.assets)
    && isPlainObject(value.master);
}

function saveErrorResponse(err: unknown): Response {
  if (err instanceof ProjectNotFoundError) return textResponse("not found", 404);
  console.error("[api/projects/:id] save failed:", err);
  return textResponse("save failed", 500);
}

export async function GET(event: APIEvent) {
  const rl = rateLimit(event.request, "projects:get", "standard");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);
  try {
    const result = await getProject(userId, id);
    if (!result) return textResponse("not found", 404);
    // Embed published flag as _published — not part of ProjectDoc schema
    return Response.json({ ...result.doc, _published: result.published });
  } catch (err) {
    console.error("[GET /api/projects/:id] failed:", err);
    return textResponse("server error", 500);
  }
}

export async function PUT(event: APIEvent) {
  const rl = rateLimit(event.request, "projects:put", "standard");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);
  let doc: unknown;
  try {
    doc = await event.request.json();
  } catch {
    return textResponse("invalid json", 400);
  }
  if (!isProjectDocPayload(doc, id)) return textResponse("bad payload", 400);
  try {
    await saveProject(userId, id, doc);
  } catch (err) {
    return saveErrorResponse(err);
  }
  return new Response(null, { status: 204 });
}

export async function PATCH(event: APIEvent) {
  const rl = rateLimit(event.request, "projects:patch", "standard");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);
  const body = await readJsonObject(event.request);
  if (body instanceof Response) return body;

  // Restore from trash
  if (body.restore === true) {
    try {
      const restored = await restoreProject(userId, id);
      return restored ? new Response(null, { status: 204 }) : textResponse("not found", 404);
    } catch (err) {
      console.error("[PATCH /api/projects/:id restore] failed:", err);
      return textResponse("server error", 500);
    }
  }

  // Published toggle — only touches the projects row, not the doc
  if (body.published !== undefined) {
    const published = parseBoolean(body.published);
    if (published === null) return textResponse("published must be boolean", 400);
    try {
      const updated = await setPublished(userId, id, published);
      return updated ? new Response(null, { status: 204 }) : textResponse("not found", 404);
    } catch (err) {
      console.error("[PATCH /api/projects/:id published] failed:", err);
      return textResponse("server error", 500);
    }
  }

  try {
    const result = await getProject(userId, id);
    if (!result) return textResponse("not found", 404);
    const doc = result.doc;

    if (body.name !== undefined) {
      const name = cleanString(body.name, 100);
      if (!name) return textResponse("name must be a non-empty string", 400);
      doc.name = name;
    }
    if (body.genre !== undefined) {
      const genre = cleanOptionalString(body.genre, 80);
      if (genre) doc.genre = genre;
      else delete doc.genre;
    }
    if (body.description !== undefined) {
      const description = cleanOptionalString(body.description, 2000);
      if (description) doc.description = description;
      else delete doc.description;
    }
    if (body.explicit !== undefined) {
      const explicit = parseBoolean(body.explicit);
      if (explicit === null) return textResponse("explicit must be boolean", 400);
      doc.explicit = explicit;
    }
    if (body.lyrics !== undefined) {
      const lyrics = cleanOptionalString(body.lyrics, 50000);
      if (lyrics) doc.lyrics = lyrics;
      else delete doc.lyrics;
    }
    if (body.coverUrl !== undefined) {
      const coverUrl = cleanOptionalString(body.coverUrl, 500000);
      if (coverUrl) doc.coverUrl = coverUrl;
      else delete doc.coverUrl;
    }

    await saveProject(userId, id, doc);

    if (body.coverUrl !== undefined) {
      const coverUrlCol = doc.coverUrl ?? null;
      await sql`UPDATE projects SET cover_url = ${coverUrlCol} WHERE id = ${id}`.catch(() => {});
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    return saveErrorResponse(err);
  }
}

export async function DELETE(event: APIEvent) {
  const rl = rateLimit(event.request, "projects:delete", "strict");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);
  const id = event.params.id;
  if (!isUuid(id)) return textResponse("invalid id", 400);
  const url = new URL(event.request.url);
  try {
    const deleted = url.searchParams.get("permanent") === "true"
      ? await permanentlyDeleteProject(userId, id)
      : await deleteProject(userId, id);
    return deleted ? new Response(null, { status: 204 }) : textResponse("not found", 404);
  } catch (err) {
    console.error("[DELETE /api/projects/:id] failed:", err);
    return textResponse("server error", 500);
  }
}
