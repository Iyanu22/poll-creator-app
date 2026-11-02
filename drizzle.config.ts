import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same .env.local loading as Next, so there is one source of env truth.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    // Migrations need a direct connection, not the pooler
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
  strict: true,
  verbose: true,
});
