const windows = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key);
  }
}

interface RateLimitOpts {
  windowMs: number;
  max: number;
}

export function checkRateLimit(
  key: string,
  opts: RateLimitOpts,
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanup();
  const now = Date.now();
  let entry = windows.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + opts.windowMs };
    windows.set(key, entry);
  }

  entry.count++;
  const allowed = entry.count <= opts.max;
  return { allowed, remaining: Math.max(0, opts.max - entry.count), resetAt: entry.resetAt };
}

export function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}

export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response("Too many requests. Please slow down.", {
    status: 429,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": String(Math.max(1, retryAfter)),
    },
  });
}

const TIERS = {
  strict: { windowMs: 60_000, max: 10 },
  standard: { windowMs: 60_000, max: 60 },
  relaxed: { windowMs: 60_000, max: 200 },
} as const;

export type RateLimitTier = keyof typeof TIERS;

export function rateLimit(
  request: Request,
  route: string,
  tier: RateLimitTier = "standard",
): Response | null {
  const ip = getClientIp(request);
  const key = `${tier}:${route}:${ip}`;
  const result = checkRateLimit(key, TIERS[tier]);
  if (!result.allowed) return rateLimitResponse(result.resetAt);
  return null;
}
