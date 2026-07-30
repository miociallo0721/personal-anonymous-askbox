import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";

import { database } from "@/db/client";

export function runMigrations() {
  migrate(database.db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
  database.sqlite.close();
  console.info("数据库迁移完成");
}
