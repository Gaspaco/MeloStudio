import { createAuthClient } from "@neondatabase/neon-js/auth";

// Create and export the Auth Client natively connecting to Neon Managed Auth
// This keeps it secure but incredibly simple to use across the app.
export const authClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL,
);
