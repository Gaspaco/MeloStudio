// POST /api/transcribe
// Sends the project's audio to Groq Whisper and returns LRC lyrics.
// Auth: optional — owned projects work with auth/cookie, published projects without.

import type { APIEvent } from "@solidjs/start/server";
import { requireUserId } from "~/lib/auth-server";
import { getProject, getPublicProjectDoc } from "~/lib/db/projects";
import type { TimelineDoc } from "~/lib/audio/projectTimeline";
import { isPlainObject, isSafeRemoteUrl, isUuid, textResponse, truncateForLog } from "./_utils";

interface GroqSegment { start: number; end: number; text: string }
interface GroqVerboseResponse { segments?: GroqSegment[]; text?: string }

function toTwoDigits(n: number) { return n.toString().padStart(2, "0"); }

function toLrcTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const sw = Math.floor(s);
  const cs = Math.round((s - sw) * 100);
  return `[${toTwoDigits(m)}:${toTwoDigits(sw)}.${toTwoDigits(cs)}]`;
}

// Accept both audio/* and video/* (e.g. video/mp4 — browsers often record audio in MP4 container)
const DATA_URI_RE = /^data:((audio|video)\/[^;]+);base64,/;
const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3",
  "audio/wav": "wav", "audio/wave": "wav",
  "audio/webm": "webm", "audio/ogg": "ogg",
  "audio/mp4": "m4a", "audio/aac": "m4a", "audio/flac": "flac",
  "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogg",
};

function firstClipDataUri(doc: TimelineDoc) {
  const tracks = (doc.uiTracks?.length ? doc.uiTracks : doc.tracks) ?? [];
  for (const track of tracks) {
    for (const clip of track.clips ?? []) {
      if (clip.kind === "midi" || !clip.dataUrl) continue;
      const m = clip.dataUrl.match(DATA_URI_RE);
      if (!m) continue;
      const mime = m[1]!;
      return { dataUri: clip.dataUrl, mime, ext: MIME_TO_EXT[mime] ?? "mp3" };
    }
  }
  return null;
}

export async function POST(event: APIEvent) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return textResponse("transcription not configured", 503);

  let body: unknown;
  try { body = await event.request.json(); }
  catch { return textResponse("invalid json", 400); }
  if (!isPlainObject(body)) return textResponse("bad payload", 400);

  const projectId = body.projectId;
  if (!isUuid(projectId)) return textResponse("invalid projectId", 400);

  let mixUrl: string | undefined;
  let clipFallback: ReturnType<typeof firstClipDataUri> = null;

  // 1. Try owned project (JWT Bearer or cookie session)
  const userId = await requireUserId(event.request);
  if (userId) {
    const owned = await getProject(userId, projectId);
    if (owned?.doc) {
      const doc = owned.doc as unknown as TimelineDoc & { mixUrl?: string };
      mixUrl = doc.mixUrl;
      if (!mixUrl) clipFallback = firstClipDataUri(doc);
    }
  }

  // 2. Fall back to published project (no auth needed)
  if (!mixUrl && !clipFallback) {
    const pubDoc = await getPublicProjectDoc(projectId);
    if (pubDoc) {
      const doc = pubDoc as unknown as TimelineDoc & { mixUrl?: string };
      mixUrl = doc.mixUrl;
      if (!mixUrl) clipFallback = firstClipDataUri(doc);
    }
  }

  if (!mixUrl && !clipFallback) {
    console.warn("[transcribe] no audio for project", { projectId, userId: userId ?? null });
    return textResponse("no audio for this project", 422);
  }

  let audioBuffer: ArrayBuffer;
  let audioMime: string;
  let audioExt: string;

  if (mixUrl) {
    if (!isSafeRemoteUrl(mixUrl)) {
      console.warn("[transcribe] blocked unsafe mixUrl", { projectId });
      return textResponse("audio source is not allowed", 422);
    }
    let r: Response;
    try {
      r = await fetch(mixUrl);
      if (!r.ok) throw new Error(`${r.status}`);
    } catch (e) {
      console.error("[transcribe] failed to download audio", e);
      return textResponse("failed to download audio", 502);
    }
    audioBuffer = await r.arrayBuffer();
    audioExt = (new URL(mixUrl).pathname.split(".").pop() ?? "mp3").toLowerCase();
    const ME: Record<string, string> = { mp3:"audio/mpeg",wav:"audio/wav",m4a:"audio/mp4",ogg:"audio/ogg",flac:"audio/flac",webm:"audio/webm" };
    audioMime = ME[audioExt] ?? "audio/mpeg";
  } else {
    const commaIdx = clipFallback!.dataUri.indexOf(",");
    if (commaIdx < 0) return textResponse("invalid audio data", 422);
    const b64 = clipFallback!.dataUri.slice(commaIdx + 1);
    let binary: string;
    try {
      binary = atob(b64);
    } catch {
      return textResponse("invalid audio data", 422);
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    audioBuffer = bytes.buffer;
    audioMime = clipFallback!.mime;
    audioExt = clipFallback!.ext;
  }

  if (audioBuffer.byteLength > 25 * 1024 * 1024) {
    return textResponse("audio exceeds 25 MB limit", 413);
  }

  const form = new FormData();
  // Normalize video/* MIME types to audio/* for Groq Whisper
  const uploadMime = audioMime.startsWith("video/") ? audioMime.replace("video/", "audio/") : audioMime;
  form.append("file", new Blob([audioBuffer], { type: uploadMime }), `audio.${audioExt}`);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("language", "en");

  const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error("[transcribe] Groq error", groqRes.status, truncateForLog(errText));
    return textResponse("transcription failed", 502);
  }

  const data = (await groqRes.json()) as GroqVerboseResponse;
  const segments = data.segments ?? [];

  if (segments.length === 0 && data.text) {
    return Response.json({ lrc: data.text.trim() });
  }

  const lrc = segments.map((s) => `${toLrcTimestamp(s.start)}${s.text.trim()}`).join("\n");
  return Response.json({ lrc });
}
