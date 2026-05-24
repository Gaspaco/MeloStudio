const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

export function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body = await request.json();
    if (!isPlainObject(body)) return textResponse("bad payload", 400);
    return body;
  } catch {
    return textResponse("invalid json", 400);
  }
}

export function cleanString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value).trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return cleaned.slice(0, maxLength);
}

export function cleanOptionalString(value: unknown, maxLength: number): string | undefined {
  if (value === null || value === undefined) return undefined;
  const cleaned = cleanString(value, maxLength);
  return cleaned ? cleaned : undefined;
}

export function parseBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function clampFiniteNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
}

export function isSafeRemoteUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.username || url.password) return false;
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.protocol === "http:" && process.env.NODE_ENV === "production") return false;

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) {
    return process.env.NODE_ENV !== "production";
  }
  if (PRIVATE_IPV4_RANGES.some((range) => range.test(host))) return false;
  if (host.startsWith("[") || host.includes(":")) return false;

  return true;
}

export function truncateForLog(value: string, maxLength = 500): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}