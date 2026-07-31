import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    // Warm the actual page during the generous web-server window so a cold
    // Turbopack compile does not consume the browser test timeout.
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "development",
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: "file:./data/e2e.db",
      ADMIN_PASSWORD: "e2e-admin-password",
      SESSION_SECRET: "e2e-session-secret-with-at-least-32-characters",
      IP_HASH_SECRET: "e2e-ip-hash-secret-with-at-least-32-characters",
      TURNSTILE_ENABLED: "false",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_CHAT_ID: "",
      ADMIN_PUBLIC_URL: "",
      TRUST_CLOUDFLARE_PROXY: "false",
      TRUST_PROXY: "false",
      EXTERNAL_SERVICES_MODE: "mock",
      TZ: "Asia/Shanghai",
    },
  },
});
