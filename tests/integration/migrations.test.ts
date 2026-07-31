import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { answers, cards, questions } from "@/db/schema";

import { createTestDatabase } from "../helpers/database";

describe("database migrations", () => {
  it("creates the complete model with foreign keys enabled", () => {
    const database = createTestDatabase();
    expect(database.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(database.db.select().from(questions).all()).toEqual([]);
    expect(database.db.select().from(answers).all()).toEqual([]);
    expect(database.db.select().from(cards).all()).toEqual([]);
    database.close();
  });

  it("adds Answer, Card and private-status fields without rewriting legacy questions", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "askbox-legacy-"));
    const sqlite = new Database(path.join(directory, "legacy.db"));
    const executeMigration = (filename: string) => {
      const statements = fs
        .readFileSync(filename, "utf8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);
      sqlite.transaction(() => {
        for (const statement of statements) sqlite.exec(statement);
      })();
    };

    try {
      executeMigration("drizzle/0000_adorable_lily_hollister.sql");
      sqlite
        .prepare(
          `INSERT INTO questions
           (content, status, ip_hash, user_agent_hash, spam_score, is_blocked,
            telegram_notified, created_at, updated_at)
           VALUES (?, 'unread', ?, ?, 0, 0, 0, ?, ?)`,
        )
        .run("迁移前的问题", "a".repeat(64), "b".repeat(64), 1, 1);

      executeMigration("drizzle/0001_puzzling_dreaming_celestial.sql");
      executeMigration("drizzle/0002_private_status_links.sql");

      expect(
        sqlite.prepare("SELECT content, status_token_hash AS statusTokenHash FROM questions").get(),
      ).toEqual({
        content: "迁移前的问题",
        statusTokenHash: null,
      });
      expect(
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('answers', 'cards')",
          )
          .all(),
      ).toHaveLength(2);
      expect(
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'questions_status_token_hash_unique'",
          )
          .get(),
      ).toEqual({ name: "questions_status_token_hash_unique" });

      executeMigration("drizzle/rollback/0002_private_status_links.sql");
      expect(
        sqlite
          .prepare("PRAGMA table_info(questions)")
          .all()
          .some((column) => (column as { name: string }).name === "status_token_hash"),
      ).toBe(false);
      expect(sqlite.prepare("SELECT content FROM questions").get()).toEqual({
        content: "迁移前的问题",
      });
    } finally {
      sqlite.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
