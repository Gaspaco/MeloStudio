// Server-only helpers for resolving the current user on API routes.
//
// TODO(neon-auth): replace with proper JWT verification against the Neon Auth
// JWKS endpoint. For now we trust an `x-user-id` header set by the client
// after login. This is fine for local dev; do NOT ship to prod as-is.

export async function requireUserId(req: Request): Promise<string | null> {
  const headerId = req.headers.get("x-user-id");
  if (headerId && headerId.length > 0 && headerId.length < 200) {
    return headerId;
  }
  // TODO: parse cookie, verify JWT, return sub claim.
  return null;
}
