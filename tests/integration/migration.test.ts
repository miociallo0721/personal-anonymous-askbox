import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function applySql(database: Database.Database, filename: string) {
  const sql = fs
    .readFileSync(path.join(process.cwd(), "drizzle", filename), "utf8")
    .replaceAll("--> statement-breakpoint", "");
  database.exec(sql);
}

describe("数据库 migration 兼容性", () => {
  it("在保留旧问题数据的情况下新增 Answer 与 Card 表", () => {
    const database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    applySql(database, "0000_adorable_lily_hollister.sql");
    database
      .prepare(
        `insert into questions
          (content, status, ip_hash, user_agent_hash, spam_score, is_blocked,
           telegram_notified, created_at, updated_at)
         values (?, 'replied', ?, ?, 0, 0, 0, ?, ?)`,
      )
      .run("旧版本问题", "a".repeat(64), "b".repeat(64), 1_000, 1_000);

    applySql(database, "0001_lovely_cardiac.sql");

    expect(database.prepare("select content from questions").get()).toEqual({
      content: "旧版本问题",
    });
    expect(
      database
        .prepare(
          "select name from sqlite_master where type = 'table' and name in ('answers','cards')",
        )
        .all(),
    ).toHaveLength(2);
    database.close();
  });
});
