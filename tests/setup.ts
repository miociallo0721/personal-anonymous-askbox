import { afterEach } from "vitest";

import { resetEnvForTests } from "@/lib/env";

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: `file:/tmp/askbox-vitest-${process.pid}.db`,
  ADMIN_PASSWORD: "test-admin-password",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  IP_HASH_SECRET: "test-ip-hash-secret-with-at-least-32-characters",
  TURNSTILE_ENABLED: "false",
  TRUST_CLOUDFLARE_PROXY: "false",
  TRUST_PROXY: "false",
  EXTERNAL_SERVICES_MODE: "live",
  TZ: "Asia/Shanghai",
});

afterEach(() => {
  resetEnvForTests();
});
