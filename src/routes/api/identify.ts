// POST /api/identify — audio fingerprinting proxy via AudD.
// Accepts multipart form with an `audio` file or public `url`, forwards to AudD,
// returns { artist, title } or null. The API key never leaves the server.
import type { APIEvent } from "@solidjs/start/server";
import { requireUserId } from "~/lib/auth-server";
import { rateLimit } from "~/lib/server/rateLimit";
import { isSafeRemoteUrl, textResponse, truncateForLog } from "./_utils";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export async function POST(event: APIEvent) {
  const rl = rateLimit(event.request, "identify", "strict");
  if (rl) return rl;
  const userId = await requireUserId(event.request);
  if (!userId) return textResponse("unauthorized", 401);

  const apiKey = process.env.AUDD_API_KEY;
  if (!apiKey) return textResponse("identify not configured", 503);

  let incoming: FormData;
  try {
    incoming = await event.request.formData();
  } catch {
    return textResponse("invalid body", 400);
  }

  const audio = incoming.get("audio");
  const url = incoming.get("url");

  const form = new FormData();
  form.append("api_token", apiKey);
  if (audio instanceof File) {
    if (audio.size > MAX_AUDIO_BYTES) return textResponse("audio exceeds 15 MB limit", 413);
    form.append("audio", audio, "clip.wav");
  } else if (typeof url === "string" && url.trim()) {
    let audioUrl: string;
    try {
      audioUrl = new URL(url.trim(), event.request.url).href;
    } catch {
      return textResponse("invalid url", 400);
    }
    if (!isSafeRemoteUrl(audioUrl)) return textResponse("url is not allowed", 400);
    form.append("url", audioUrl);
  } else {
    return textResponse("missing audio or url field", 400);
  }

  const auddRes = await fetch("https://api.audd.io/", { method: "POST", body: form });
  if (!auddRes.ok) {
    const errText = await auddRes.text().catch(() => "");
    console.error("[identify] AudD error", auddRes.status, truncateForLog(errText));
    return Response.json(null);
  }

  const data = (await auddRes.json()) as {
    status: string;
    result?: { artist: string; title: string } | null;
  };

  if (data.status === "success" && data.result?.title) {
    return Response.json({ artist: data.result.artist ?? "", title: data.result.title });
  }
  return Response.json(null);
}
