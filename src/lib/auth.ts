import { createInternalNeonAuth } from "@neondatabase/neon-js/auth";

// createInternalNeonAuth returns { adapter, getJWTToken }.
// - adapter: the raw Better Auth client (signIn, signUp, getSession, etc.)
// - getJWTToken: reads the token from the in-memory session without hitting an
//   additional network endpoint (avoids the /get-j-w-t-token 404 that the raw
//   Better Auth client would call via its $fetch proxy).
const _auth = createInternalNeonAuth(import.meta.env.VITE_NEON_AUTH_URL);

export const authClient = _auth.adapter;
export const getJWTToken = () => _auth.getJWTToken();
