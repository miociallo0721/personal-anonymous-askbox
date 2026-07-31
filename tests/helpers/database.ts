import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createDatabase } from "@/db/client";

export function createTestDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "askbox-test-"));
  const database = createDatabase(`file:${path.join(directory, "test.db")}`);
  migrate(database.db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return {
    ...database,
    directory,
    close() {
      database.sqlite.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
