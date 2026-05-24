// POST /api/identify — audio fingerprinting proxy via AudD.
// Accepts multipart form with an `audio` file or public `url`, forwards to AudD,
// returns { artist, title } or null. The API key never leaves the server.
import type { APIEvent } from "@solidjs/start/server";

export async function POST(event: APIEvent) {
  const apiKey = process.env.AUDD_API_KEY;
  if (!apiKey) return new Response("AudD not configured", { status: 503 });

  let incoming: FormData;
  try {
    incoming = await event.request.formData();
  } catch {
    return new Response("invalid body", { status: 400 });
  }

  const audio = incoming.get("audio");
  const url = incoming.get("url");

  const form = new FormData();
  form.append("api_token", apiKey);
  if (audio instanceof File) {
    form.append("audio", audio, "clip.wav");
  } else if (typeof url === "string" && url.trim()) {
    form.append("url", new URL(url.trim(), event.request.url).href);
  } else {
    return new Response("missing audio or url field", { status: 400 });
  }

  const auddRes = await fetch("https://api.audd.io/", { method: "POST", body: form });
  if (!auddRes.ok) return Response.json(null);

  const data = (await auddRes.json()) as {
    status: string;
    result?: { artist: string; title: string } | null;
  };

  if (data.status === "success" && data.result?.title) {
    return Response.json({ artist: data.result.artist ?? "", title: data.result.title });
  }
  return Response.json(null);
}
