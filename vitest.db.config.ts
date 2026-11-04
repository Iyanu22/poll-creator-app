import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against a real Postgres (`pnpm test:db`). They write
// to the database in DATABASE_URL, so they're kept out of `pnpm test`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.db.test.ts"],
    setupFiles: ["./vitest.db.setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
