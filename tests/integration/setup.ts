import fs from "node:fs";
import path from "node:path";
import { beforeEach } from "vitest";

import {
  adminLoginAttempts,
  adminSessions,
  answers,
  blockedSources,
  cards,
  questions,
} from "@/db/schema";

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: "file:./.tmp/integration.db",
  ADMIN_PASSWORD: "test-admin-password",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  IP_HASH_SECRET: "test-ip-hash-secret-with-at-least-32-characters",
  TURNSTILE_ENABLED: "true",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-site-key",
  TURNSTILE_SECRET_KEY: "test-secret-key",
  TURNSTILE_EXPECTED_HOSTNAME: "",
  EXTERNAL_SERVICES_MOCK: "true",
  TRUST_CLOUDFLARE_PROXY: "false",
  TRUST_PROXY: "false",
  LOGIN_ATTEMPT_RETENTION_DAYS: "30",
  TZ: "Asia/Shanghai",
});

const integrationState = globalThis as typeof globalThis & {
  askboxIntegrationReady?: boolean;
};

if (!integrationState.askboxIntegrationReady) {
  const temporaryDirectory = path.resolve(".tmp");
  fs.mkdirSync(temporaryDirectory, { recursive: true });
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(path.join(temporaryDirectory, `integration.db${suffix}`), { force: true });
  }
  const { runMigrations } = await import("@/db/migrate");
  runMigrations();
  integrationState.askboxIntegrationReady = true;
}

const { db } = await import("@/db/client");

beforeEach(() => {
  db.delete(cards).run();
  db.delete(answers).run();
  db.delete(questions).run();
  db.delete(blockedSources).run();
  db.delete(adminSessions).run();
  db.delete(adminLoginAttempts).run();
});
