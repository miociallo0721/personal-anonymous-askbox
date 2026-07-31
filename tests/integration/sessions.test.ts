import { describe, expect, it } from "vitest";

import { deleteAdminSession, hasValidAdminSession, storeAdminSession } from "@/services/sessions";

import { createTestDatabase } from "../helpers/database";

const secrets = {
  sessionSecret: "integration-session-secret-at-least-32-characters",
  adminPassword: "integration-admin-password",
};

describe("database-backed administrator sessions", () => {
  it("accepts active sessions and rejects expiry or secret rotation", () => {
    const database = createTestDatabase();
    storeAdminSession(database.db, {
      token: "opaque-session-token",
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      expiresAt: new Date("2026-07-19T00:00:00.000Z"),
      ...secrets,
    });

    expect(
      hasValidAdminSession(database.db, {
        token: "opaque-session-token",
        now: new Date("2026-07-18T12:00:00.000Z"),
        ...secrets,
      }),
    ).toBe(true);
    expect(
      hasValidAdminSession(database.db, {
        token: "opaque-session-token",
        now: new Date("2026-07-20T00:00:00.000Z"),
        ...secrets,
      }),
    ).toBe(false);
    expect(
      hasValidAdminSession(database.db, {
        token: "opaque-session-token",
        now: new Date("2026-07-18T12:00:00.000Z"),
        ...secrets,
        adminPassword: "rotated-password",
      }),
    ).toBe(false);

    deleteAdminSession(database.db, { token: "opaque-session-token", ...secrets });
    expect(
      hasValidAdminSession(database.db, {
        token: "opaque-session-token",
        now: new Date("2026-07-18T12:00:00.000Z"),
        ...secrets,
      }),
    ).toBe(false);
    database.close();
  });
});
