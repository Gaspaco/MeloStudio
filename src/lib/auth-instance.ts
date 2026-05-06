// Server-only — never import from client code.
// Self-hosted Better Auth instance with email/password + Google + Facebook + Twitter.

import { betterAuth } from "better-auth";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "https://melostudio.app",
  basePath: "/api/auth",

  database: pool,

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      mapProfileToUser: (profile: any) => ({
        email: profile.email ?? `${profile.id}@facebook.placeholder.local`,
      }),
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      disableDefaultScope: true,
      scope: ["users.read", "tweet.read"],
    },
  },

  account: {
    // Store the full OAuth state payload in a single encrypted cookie instead of
    // splitting between DB verification + a separate signed cookie.  This prevents
    // "State not persisted correctly" mismatches that occur when multiple login
    // attempts overwrite the signed-state cookie before the first flow completes.
    storeStateStrategy: "cookie",
  },

  trustedOrigins: [
    "https://melostudio.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
  ],
});
