import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Database tests write to a real Postgres: `pnpm test:db`
    exclude: [...configDefaults.exclude, "src/**/*.db.test.ts"],
  },
});
