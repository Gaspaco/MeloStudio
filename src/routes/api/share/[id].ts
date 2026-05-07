// GET /api/share/:id — public endpoint, no auth required.
// Returns project summary only when published = true.
import type { APIEvent } from "@solidjs/start/server";
import { getPublicProject } from "~/lib/db/projects";

export async function GET(event: APIEvent) {
  const id = event.params.id;
  if (!id) return new Response("missing id", { status: 400 });
  const project = await getPublicProject(id);
  if (!project) return new Response("not found", { status: 404 });
  return Response.json(project);
}
