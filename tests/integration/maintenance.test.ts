import { describe, expect, it } from "vitest";

import { adminLoginAttempts, adminSessions } from "@/db/schema";
import { runMaintenance } from "@/services/maintenance";
import { createMigratedTestDatabase } from "../helpers/database";

describe("数据生命周期维护", () => {
  it("只清理过期 Session 和超出保留期的登录记录", () => {
    const database = createMigratedTestDatabase();
    const now = new Date("2026-07-30T10:00:00.000Z");
    database.db
      .insert(adminSessions)
      .values([
        {
          tokenHash: "a".repeat(64),
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          expiresAt: new Date("2026-07-01T00:00:00.000Z"),
        },
        {
          tokenHash: "b".repeat(64),
          createdAt: now,
          expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ])
      .run();
    database.db
      .insert(adminLoginAttempts)
      .values([
        {
          ipHash: "c".repeat(64),
          succeeded: false,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
        },
        { ipHash: "d".repeat(64), succeeded: true, createdAt: now },
      ])
      .run();

    expect(runMaintenance(database.db, { loginAttemptRetentionDays: 30 }, now)).toMatchObject({
      expiredSessions: 1,
      obsoleteLoginAttempts: 1,
    });
    expect(database.db.select().from(adminSessions).all()).toHaveLength(1);
    expect(database.db.select().from(adminLoginAttempts).all()).toHaveLength(1);
    database.close();
  });
});
