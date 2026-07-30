import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import * as schema from "@/db/schema";

export function databasePath(databaseUrl = process.env.DATABASE_URL ?? "file:./data/askbox.db") {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL 必须是 file: 开头的 SQLite 路径");
  }
  const filename = databaseUrl.slice(5);
  if (!filename) throw new Error("DATABASE_URL 未指定数据库文件");
  return path.resolve(filename);
}

export function createDatabase(databaseUrl?: string) {
  const filename = databasePath(databaseUrl);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return { db: drizzle(sqlite, { schema }), sqlite };
}

const globalDatabase = globalThis as unknown as {
  askboxDatabase?: ReturnType<typeof createDatabase>;
};

export const database = globalDatabase.askboxDatabase ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalDatabase.askboxDatabase = database;

export const db = database.db;
