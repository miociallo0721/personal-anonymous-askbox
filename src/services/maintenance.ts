import { lt } from "drizzle-orm";

import { adminLoginAttempts, adminSessions } from "@/db/schema";
import type { DatabaseClient } from "@/db/types";

export type MaintenancePolicy = {
  loginAttemptRetentionDays: number;
};

export function runMaintenance(
  database: DatabaseClient,
  policy: MaintenancePolicy,
  now = new Date(),
) {
  const loginAttemptCutoff = new Date(
    now.getTime() - policy.loginAttemptRetentionDays * 24 * 60 * 60_000,
  );

  return database.transaction((tx) => {
    const expiredSessions = tx
      .delete(adminSessions)
      .where(lt(adminSessions.expiresAt, now))
      .run().changes;
    const obsoleteLoginAttempts = tx
      .delete(adminLoginAttempts)
      .where(lt(adminLoginAttempts.createdAt, loginAttemptCutoff))
      .run().changes;

    return {
      expiredSessions,
      obsoleteLoginAttempts,
      completedAt: now.toISOString(),
    };
  });
}
