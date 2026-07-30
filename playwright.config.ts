import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `corepack pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: "file:./.tmp/e2e.db",
      ADMIN_PASSWORD: "e2e-admin-password",
      SESSION_SECRET: "e2e-session-secret-with-at-least-32-characters",
      IP_HASH_SECRET: "e2e-ip-hash-secret-with-at-least-32-characters",
      TURNSTILE_ENABLED: "true",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "e2e-site-key",
      TURNSTILE_SECRET_KEY: "e2e-secret-key",
      EXTERNAL_SERVICES_MOCK: "true",
      TRUST_CLOUDFLARE_PROXY: "false",
      TRUST_PROXY: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  outputDir: "output/playwright/test-results",
});
