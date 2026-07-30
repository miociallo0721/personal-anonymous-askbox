import { database } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { validateRuntimeEnv } from "@/lib/env";
import { errorMessage, logger } from "@/lib/logger";
import { runMaintenance } from "@/services/maintenance";

try {
  const env = validateRuntimeEnv();
  runMigrations();
  const result = runMaintenance(database.db, {
    loginAttemptRetentionDays: env.LOGIN_ATTEMPT_RETENTION_DAYS,
  });
  database.sqlite.pragma("optimize");
  logger.info("maintenance.completed", result);
} catch (error) {
  logger.error("maintenance.failed", { error: errorMessage(error) });
  process.exitCode = 1;
} finally {
  database.sqlite.close();
}
