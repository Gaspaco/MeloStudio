// Server-only helpers for resolving the current user on API routes.
// Verifies the JWT Bearer token against the Neon Auth JWKS endpoint.
// Never import this from client code.

import { createRemoteJWKSet, jwtVerify } from "jose";

const authUrl = process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL ?? "";

// JWKS keyset is cached after first request — no sense re-fetching it every hit
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks && authUrl) {
    jwks = createRemoteJWKSet(new URL(`${authUrl.replace(/\/$/, "")}/.well-known/jwks.json`));
  }
  return jwks;
}

export async function requireUserId(req: Request): Promise<string | null> {
  const authorization = req.headers.get("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;

  const keyset = getJwks();
  if (!keyset) return null;

  try {
    const { payload } = await jwtVerify(token, keyset);
    const sub = payload.sub;
    return typeof sub === "string" && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}
