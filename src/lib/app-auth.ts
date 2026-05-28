import { authClient, getJWTToken } from "./auth";
import { socialAuthClient } from "./social-auth";

export type AppAuthProvider = "neon" | "better-auth";

type StoredAuthState = AppAuthProvider | "logged-out";

const AUTH_STATE_KEY = "ms_auth_provider";
const DASH_START_KEY = "ms_dash_start";

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
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(DASH_START_KEY); } catch {}
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

async function signOutNeon() {
  try { await authClient.signOut(); } catch {}
}

export async function signOutApp() {
  const stored = readAuthState();
  const session = stored === "logged-out" ? null : await getAppSession({ respectLoggedOut: false, persist: false });
  const provider = stored === "neon" || stored === "better-auth" ? stored : session?.provider;

  if (provider === "better-auth") await signOutBetterAuth();
  if (provider === "neon") await signOutNeon();

  markLoggedOut();
}

export async function getApiBearerToken(): Promise<string | null> {
  const stored = readAuthState();
  if (stored === "logged-out" || stored === "better-auth") return null;

  try { return await getJWTToken(); } catch { return null; }
}