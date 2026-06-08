// Server-only — never import from client code.
// Self-hosted Better Auth instance with email/password + Google + Twitter.

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
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const twitterClientId = process.env.TWITTER_CLIENT_ID;
const twitterClientSecret = process.env.TWITTER_CLIENT_SECRET;

const fallbackBaseUrl = (process.env.BETTER_AUTH_URL ?? "https://melostudio.nl").replace(/\/$/, "");
const isProduction = process.env.NODE_ENV === "production";

const productionAllowedHosts = [
  "melostudio.nl",
  "www.melostudio.nl",
  "melostudio.online",
  "www.melostudio.online",
  "melostudio.site",
  "www.melostudio.site",
  "melostudio.app",
  "www.melostudio.app",
  "melo-studio.netlify.app",
];

const devAllowedHosts = ["localhost:*", "127.0.0.1:*"];
const allowedHosts = isProduction
  ? productionAllowedHosts
  : [...productionAllowedHosts, ...devAllowedHosts];

const productionTrustedOrigins = [
  "https://melostudio.nl",
  "https://www.melostudio.nl",
  "https://melostudio.online",
  "https://www.melostudio.online",
  "https://melostudio.site",
  "https://www.melostudio.site",
  "https://melostudio.app",
  "https://www.melostudio.app",
  "https://melo-studio.netlify.app",
];

const devTrustedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
];

const trustedOrigins = isProduction
  ? productionTrustedOrigins
  : [...productionTrustedOrigins, ...devTrustedOrigins];

type BetterAuthOptions = Parameters<typeof betterAuth>[0];
const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};

if (googleClientId && googleClientSecret) {
  socialProviders.google = {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
  };
}

if (twitterClientId && twitterClientSecret) {
  socialProviders.twitter = {
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
  };
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

const plugins = process.env.BETTER_AUTH_API_KEY ? [dash()] : [];

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
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await import("./mailer");
      await sendPasswordResetEmail(user.email, url);
    },
  },

  socialProviders,

  account: {
    // Store the full OAuth state payload in a single encrypted cookie instead of
    // splitting between DB verification + a separate signed cookie.  This prevents
    // "State not persisted correctly" mismatches that occur when multiple login
    // attempts overwrite the signed-state cookie before the first flow completes.
    storeStateStrategy: "cookie",
  },

  trustedOrigins,

  advanced: {
    useSecureCookies: isProduction,
  },

  onAPIError: {
    onError: (error) => {
      console.error("[Better Auth] API error:", error);
    },
  },

  plugins,
});
