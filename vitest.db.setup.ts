import { existsSync } from "node:fs";

// The app's env file, loaded before any test imports the database. Not via
// @next/env: under Vitest NODE_ENV is "test", which skips .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
