import { adminLoginAttempts, adminSessions } from "@/db/schema";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../helpers/database";

describe("scheduled maintenance command", () => {
  it("removes expired security records without touching active records", () => {
    const database = createTestDatabase();
    const now = new Date();
    database.db
      .insert(adminSessions)
      .values([
        {
          tokenHash: "expired",
          createdAt: new Date(now.getTime() - 40 * 86_400_000),
          expiresAt: new Date(now.getTime() - 1_000),
        },
        {
          tokenHash: "active",
          createdAt: now,
          expiresAt: new Date(now.getTime() + 86_400_000),
        },
      ])
      .run();
    database.db
      .insert(adminLoginAttempts)
      .values([
        {
          ipHash: "a".repeat(64),
          succeeded: false,
          createdAt: new Date(now.getTime() - 31 * 86_400_000),
        },
        { ipHash: "b".repeat(64), succeeded: false, createdAt: now },
      ])
      .run();

    const result = spawnSync(process.execPath, ["scripts/maintenance.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${database.directory}/test.db` },
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      expiredSessions: 1,
      oldLoginAttempts: 1,
    });
    expect(database.db.select().from(adminSessions).all()).toHaveLength(1);
    expect(database.db.select().from(adminLoginAttempts).all()).toHaveLength(1);
    database.close();
  });
});
