import { createInternalNeonAuth } from "@neondatabase/neon-js/auth";

const auth = createInternalNeonAuth(
  import.meta.env.VITE_NEON_AUTH_URL,
);

export const authClient = auth.adapter;
export const getJWTToken = () => auth.getJWTToken();
