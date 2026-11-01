import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { SAMPLE_CREATOR } from "@/domain/sample-sandbox";
import { deleteExpiredGuests, seedGuestSandbox } from "@/server/guest-sandbox";

// Creators sign in with Google or GitHub. "Try as guest" creates an anonymous
// user who plays the sample data's creator and owns a private copy of the
// sample polls for 24 hours.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user.isAnonymous !== true) return;
          await seedGuestSandbox(user.id);
          // Housekeeping rides on guest arrivals, so no cron is needed.
          // It must never cost the new guest their sandbox.
          await deleteExpiredGuests().catch((error) =>
            console.error("Expired guest cleanup failed", error),
          );
        },
      },
    },
  },
  plugins: [
    // A guest who then signs in with OAuth loses the sandbox: the plugin
    // deletes the anonymous user after linking (its default), and their
    // polls cascade with it.
    anonymous({ generateName: () => SAMPLE_CREATOR.name }),
    nextCookies(),
  ],
});
