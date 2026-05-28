// Server-only helpers for resolving the current user on API routes.
// Verifies the JWT Bearer token against the Neon Auth JWKS endpoint,
// then falls back to a Better Auth session cookie for Twitter logins.
// Never import this from client code.

import { createRemoteJWKSet, jwtVerify } from "jose";
import { auth } from "./auth-instance";

const authUrl = (process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL ?? "").replace(/\/$/, "");

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks && authUrl) {
    jwks = createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`));
  }
  return jwks;
}

export async function requireUserId(req: Request): Promise<string | null> {
  // 1. Neon Auth JWT Bearer token (email/password + Google)
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

  // 2. Better Auth session cookie (Twitter)
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) return session.user.id;
  } catch (err) {
    console.error("[requireUserId] getSession threw:", err);
    /* no session */
  }

  return null;
}
