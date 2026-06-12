import { authClient, getJWTToken } from "./auth";
import { socialAuthClient } from "./social-auth";

export type AppAuthProvider = "neon" | "better-auth";

type StoredAuthState = AppAuthProvider | "logged-out";

const AUTH_STATE_KEY = "ms_auth_provider";

function readAuthState(): StoredAuthState | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(AUTH_STATE_KEY);
  return value === "neon" || value === "better-auth" || value === "logged-out" ? value : null;
}

function writeAuthState(value: StoredAuthState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STATE_KEY, value);
}

export function markAuthProvider(provider: AppAuthProvider) {
  writeAuthState(provider);
}

export function markLoggedOut() {
  writeAuthState("logged-out");
}

export async function getAppSession(options: { respectLoggedOut?: boolean; persist?: boolean } = {}) {
  const respectLoggedOut = options.respectLoggedOut ?? true;
  const persist = options.persist ?? true;
  const stored = readAuthState();

  if (respectLoggedOut && stored === "logged-out") return null;

  if (stored === "better-auth") {
    try {
      const { data } = await socialAuthClient.getSession();
      if (data?.user) return { provider: "better-auth" as const, data, user: data.user };
    } catch {}
    return null;
  }

  if (stored === "neon") {
    try {
      const { data } = await authClient.getSession();
      if (data?.user) return { provider: "neon" as const, data, user: data.user };
    } catch {}
    return null;
  }

  // No stored hint — probe both providers in preference order and cache the winner to skip the probe on subsequent calls
  try {
    const { data } = await socialAuthClient.getSession();
    if (data?.user) {
      if (persist) markAuthProvider("better-auth");
      return { provider: "better-auth" as const, data, user: data.user };
    }
  } catch {}

  try {
    const { data } = await authClient.getSession();
    if (data?.user) {
      if (persist) markAuthProvider("neon");
      return { provider: "neon" as const, data, user: data.user };
    }
  } catch {}

  return null;
}

async function signOutBetterAuth() {
  try {
    await socialAuthClient.signOut();
    return;
  } catch {}

  try {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      credentials: "include",
    });
  } catch {}
}

export async function signOutApp() {
  // Neon Auth uses stateless JWTs — no server-side session to invalidate.
  // Marking logged-out locally is sufficient; the JWT expires on its own.
  await signOutBetterAuth();
  markLoggedOut();
}

export async function getApiBearerToken(): Promise<string | null> {
  const stored = readAuthState();
  if (stored === "logged-out" || stored === "better-auth") return null;

  try { return await getJWTToken(); } catch { return null; }
}