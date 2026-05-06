// Client-side Better Auth instance pointing at our own server's /api/auth.
// Used for social providers (Twitter/X) not supported by the Neon-hosted auth.
import { createAuthClient } from "better-auth/client";

export const socialAuthClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL ?? (typeof window !== "undefined" ? window.location.origin : ""),
});
