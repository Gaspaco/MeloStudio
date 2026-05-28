// GET  /api/projects           - list the current user's active projects
// GET  /api/projects?deleted=true - list trashed projects (auto-purges >10 days)
// POST /api/projects            - create a new project { name }
import type { APIEvent } from "@solidjs/start/server";
import { listProjects, listDeletedProjects, createProject } from "~/lib/db/projects";
import { requireUserId } from "~/lib/auth-server";
import { cleanString, isPlainObject, textResponse } from "../_utils";

export async function GET(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);
  try {
    const url = new URL(event.request.url);
    if (url.searchParams.get("deleted") === "true") {
      const items = await listDeletedProjects(userId);
      return Response.json(items);
    }
    const items = await listProjects(userId);
    return Response.json(items);
  } catch (err) {
    console.error("[GET /api/projects] failed:", err);
    return textResponse("server error", 500);
  }
}

export async function POST(event: APIEvent) {
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);
  let body: unknown = {};
  try {
    body = await event.request.json();
  } catch {
    body = {};
  }
  if (!isPlainObject(body)) return textResponse("bad payload", 400);

  const name = cleanString(body.name ?? "Untitled Project", 100) || "Untitled Project";
  try {
    const doc = await createProject(userId, name);
    return Response.json(doc, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects] failed:", err);
    return textResponse("server error", 500);
  }
}
