import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabase } from "@/db/client";
import { questions } from "@/db/schema";
import { saveQuestion } from "@/services/submission";

const temporaryDirectories: string[] = [];

function testDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "askbox-test-"));
  temporaryDirectories.push(directory);
  const database = createDatabase(`file:${path.join(directory, "test.db")}`);
  migrate(database.db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return database;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("问题提交", () => {
  it("Telegram 推送异常时问题仍会成功保存", async () => {
    const database = testDatabase();
    const result = await saveQuestion(
      database.db,
      {
        content: "Telegram 失败时，这个问题还在吗？",
        ipHash: "a".repeat(64),
        userAgentHash: "b".repeat(64),
        now: new Date("2026-07-18T00:00:00.000Z"),
      },
      async () => {
        throw new Error("simulated Telegram outage");
      },
    );

    expect(result.kind).toBe("saved");
    const saved = database.db.select().from(questions).get();
    expect(saved?.content).toContain("这个问题还在吗");
    expect(saved?.telegramNotified).toBe(false);
    expect(saved?.telegramError).toBe("simulated Telegram outage");
    database.sqlite.close();
  });

  it("每分钟第二次提交会被数据库限流", async () => {
    const database = testDatabase();
    const notify = async () => ({ success: true });
    const input = {
      content: "第一个正常问题",
      ipHash: "c".repeat(64),
      userAgentHash: "d".repeat(64),
      now: new Date("2026-07-18T00:00:00.000Z"),
    };
    expect((await saveQuestion(database.db, input, notify)).kind).toBe("saved");
    const second = await saveQuestion(
      database.db,
      { ...input, content: "第二个正常问题", now: new Date("2026-07-18T00:00:30.000Z") },
      notify,
    );
    expect(second.kind).toBe("rate-limited");
    database.sqlite.close();
  });
});
