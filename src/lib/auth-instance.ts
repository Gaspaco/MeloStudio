// Server-only — never import from client code.
// Self-hosted Better Auth instance with email/password + Google + Facebook + Twitter.

import { betterAuth } from "better-auth";
import { dash } from "@better-auth/infra";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL env var is required");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required`);
  return value;
}

const betterAuthSecret = requireEnv("BETTER_AUTH_SECRET");
const googleClientId = requireEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
const facebookClientId = requireEnv("FACEBOOK_CLIENT_ID");
const facebookClientSecret = requireEnv("FACEBOOK_CLIENT_SECRET");
const twitterClientId = requireEnv("TWITTER_CLIENT_ID");
const twitterClientSecret = requireEnv("TWITTER_CLIENT_SECRET");

const fallbackBaseUrl = process.env.BETTER_AUTH_URL ?? "https://melostudio.nl";
const allowedHosts = [
  "melostudio.nl",
  "www.melostudio.nl",
  "melostudio.online",
  "www.melostudio.online",
  "melostudio.site",
  "www.melostudio.site",
  "melostudio.app",
  "www.melostudio.app",
  "melo-studio.netlify.app",
  "localhost:*",
  "127.0.0.1:*",
];

const trustedOrigins = [
  "https://melostudio.nl",
  "https://www.melostudio.nl",
  "https://melostudio.online",
  "https://www.melostudio.online",
  "https://melostudio.site",
  "https://www.melostudio.site",
  "https://melostudio.app",
  "https://www.melostudio.app",
  "https://melo-studio.netlify.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
];

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export const auth = betterAuth({
  secret: betterAuthSecret,
  baseURL: {
    allowedHosts,
    protocol: "auto",
    fallback: fallbackBaseUrl,
  },
  basePath: "/api/auth",

  database: pool,

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    },
    facebook: {
      clientId: facebookClientId,
      clientSecret: facebookClientSecret,
      mapProfileToUser: (profile: { email?: string | null; id?: string | number }) => ({
        email: profile.email ?? `${profile.id}@facebook.placeholder.local`,
      }),
    },
    twitter: {
      clientId: twitterClientId,
      clientSecret: twitterClientSecret,
      disableDefaultScope: true,
      authorizationEndpoint: "https://x.com/i/oauth2/authorize?prompt=consent",
      scope: ["users.read", "tweet.read", "offline.access"],
      mapProfileToUser: (profile: { data?: { id?: string; email?: string; name?: string; profile_image_url?: string } }) => ({
        // Twitter doesn't reliably return email without the users.email scope
        // (which requires special app approval). Fall back to a unique placeholder
        // so Better Auth can satisfy the NOT NULL email constraint in the DB.
        email: profile.data?.email ?? `twitter_${profile.data?.id ?? "user"}@twitter.placeholder.local`,
        name: profile.data?.name,
        // Replace Twitter's tiny _normal (48x48) thumbnail with the 400x400 version
        image: profile.data?.profile_image_url?.replace(/_normal(\.[^.]+)$/, "_400x400$1"),
      }),
    },
  },

  account: {
    // Store the full OAuth state payload in a single encrypted cookie instead of
    // splitting between DB verification + a separate signed cookie.  This prevents
    // "State not persisted correctly" mismatches that occur when multiple login
    // attempts overwrite the signed-state cookie before the first flow completes.
    storeStateStrategy: "cookie",
  },

  trustedOrigins,

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  onAPIError: {
    onError: (error) => {
      console.error("[Better Auth] API error:", error);
    },
  },

  plugins: [
    ...(process.env.BETTER_AUTH_API_KEY ? [dash()] : []),
  ],
});
