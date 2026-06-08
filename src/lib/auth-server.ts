// Server-only helpers for resolving the current user on API routes.
// Prefers a Better Auth session cookie for Twitter logins, then falls back to
// verifying a Neon Auth JWT Bearer token against the Neon Auth JWKS endpoint.
// Never import this from client code.

import { createRemoteJWKSet, jwtVerify } from "jose";

const authUrl = (process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL ?? "").replace(/\/$/, "");

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks && authUrl) {
    jwks = createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`));
  }
  return jwks;
}

export async function requireUserId(req: Request): Promise<string | null> {
  // 1. Better Auth session cookie (Twitter). Prefer this over a stale Neon JWT.
  try {
    const { auth } = await import("./auth-instance");
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) return session.user.id;
  } catch (err) {
    console.error("[requireUserId] Better Auth session check failed:", err);
    /* no Better Auth session */
  }

  // 2. Neon Auth JWT Bearer token (email/password + Google)
  const authorization = req.headers.get("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (token) {
    const keyset = getJwks();
    if (keyset) {
      try {
        const { payload } = await jwtVerify(token, keyset);
        const sub = payload.sub;
        if (typeof sub === "string" && sub.length > 0) return sub;
      } catch { /* fall through */ }
    }
  }

  return null;
}
