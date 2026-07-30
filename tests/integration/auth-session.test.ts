import { describe, expect, it } from "vitest";

import { adminSessions } from "@/db/schema";
import {
  createAdminSession,
  destroyAdminSession,
  SESSION_DURATION_MS,
  validateAdminSession,
} from "@/lib/auth";
import { createMigratedTestDatabase } from "../helpers/database";

describe("管理员 Session 数据库集成", () => {
  it("只保存 token 哈希，并按过期时间验证", () => {
    const database = createMigratedTestDatabase();
    const now = new Date("2026-07-30T10:00:00.000Z");
    const session = createAdminSession(database.db, now, "plain-session-token");
    const stored = database.db.select().from(adminSessions).get();

    expect(stored?.tokenHash).not.toContain("plain-session-token");
    expect(validateAdminSession(database.db, session.token, now)).toBe(true);
    expect(
      validateAdminSession(
        database.db,
        session.token,
        new Date(now.getTime() + SESSION_DURATION_MS + 1),
      ),
    ).toBe(false);
    database.close();
  });

  it("退出时只删除当前 Session", () => {
    const database = createMigratedTestDatabase();
    const first = createAdminSession(database.db, new Date(), "first-session-token");
    const second = createAdminSession(database.db, new Date(), "second-session-token");
    destroyAdminSession(database.db, first.token);

    expect(validateAdminSession(database.db, first.token)).toBe(false);
    expect(validateAdminSession(database.db, second.token)).toBe(true);
    database.close();
  });
});
