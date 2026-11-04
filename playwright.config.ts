import { defineConfig } from "@playwright/test";

// Outside-in checks against a running app, local or deployed:
//   pnpm test:e2e                                   (http://localhost:3000)
//   BASE_URL=https://your-app.vercel.app pnpm test:e2e
// Uses the installed Chrome, so there's no browser download.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
  },
});
