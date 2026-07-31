import Database from "better-sqlite3";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_LOGIN_ATTEMPT_RETENTION_DAYS = 30;

export function resolveDatabasePath(databaseUrl) {
  if (!databaseUrl?.startsWith("file:") || databaseUrl.length <= 5) {
    throw new Error("DATABASE_URL 必须指向 file: SQLite 数据库");
  }
  return path.resolve(databaseUrl.slice(5));
}

export function parseMaintenanceOptions(argv) {
  const dryRun = argv.includes("--dry-run");
  const retentionArgument = argv.find((value) => value.startsWith("--login-attempt-days="));
  const loginAttemptRetentionDays = retentionArgument
    ? Number(retentionArgument.split("=")[1])
    : DEFAULT_LOGIN_ATTEMPT_RETENTION_DAYS;
  if (!Number.isInteger(loginAttemptRetentionDays) || loginAttemptRetentionDays < 1) {
    throw new Error("--login-attempt-days 必须是正整数");
  }
  return { dryRun, loginAttemptRetentionDays };
}

export function runMaintenance({
  databaseUrl,
  now = new Date(),
  dryRun = false,
  loginAttemptRetentionDays = DEFAULT_LOGIN_ATTEMPT_RETENTION_DAYS,
}) {
  const sqlite = new Database(resolveDatabasePath(databaseUrl), {
    readonly: dryRun,
    fileMustExist: true,
  });
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  try {
    const cutoff = now.getTime() - loginAttemptRetentionDays * 24 * 60 * 60_000;
    const countExpiredSessions = sqlite
      .prepare("SELECT count(*) AS value FROM admin_sessions WHERE expires_at < ?")
      .get(now.getTime()).value;
    const countOldLoginAttempts = sqlite
      .prepare("SELECT count(*) AS value FROM admin_login_attempts WHERE created_at < ?")
      .get(cutoff).value;

    if (!dryRun) {
      sqlite.transaction(() => {
        sqlite.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").run(now.getTime());
        sqlite.prepare("DELETE FROM admin_login_attempts WHERE created_at < ?").run(cutoff);
      })();
      sqlite.pragma("wal_checkpoint(PASSIVE)");
    }

    return {
      dryRun,
      expiredSessions: countExpiredSessions,
      oldLoginAttempts: countOldLoginAttempts,
      loginAttemptRetentionDays,
    };
  } finally {
    sqlite.close();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  try {
    const options = parseMaintenanceOptions(process.argv.slice(2));
    const result = runMaintenance({
      databaseUrl: process.env.DATABASE_URL ?? "file:./data/askbox.db",
      ...options,
    });
    console.info(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "维护任务失败";
    console.error(JSON.stringify({ ok: false, error: message.slice(0, 300) }));
    process.exitCode = 1;
  }
}
