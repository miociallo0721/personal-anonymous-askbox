import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { questions } from "@/db/schema";
import { generateStatusToken, hashStatusToken } from "@/lib/status-token";
import { saveAnswer } from "@/services/answers";
import { exportShareCard } from "@/services/cards";
import { getQuestionStatusByToken } from "@/services/question-status";
import type { ShareCardRenderer } from "@/services/share-card-renderer";
import { saveQuestion } from "@/services/submission";

import { createTestDatabase } from "../helpers/database";

const notify = async () => ({ success: true });

async function submitQuestion(
  database: ReturnType<typeof createTestDatabase>,
  content = "以后还能回来查看这个问题吗？",
) {
  const result = await saveQuestion(
    database.db,
    {
      content,
      ipHash: randomUUID().replaceAll("-", "").padEnd(64, "a"),
      userAgentHash: "b".repeat(64),
      now: new Date("2026-07-31T00:00:00.000Z"),
    },
    notify,
  );
  if (result.kind !== "saved") throw new Error("question was not saved");
  return result;
}

describe("private question status persistence", () => {
  it("returns a secret once, stores only its hash, and finds the same question", async () => {
    const database = createTestDatabase();
    try {
      const result = await submitQuestion(database);
      const saved = database.db.select().from(questions).get();

      expect(saved?.statusTokenHash).toBe(hashStatusToken(result.statusToken));
      expect(saved?.statusTokenHash).not.toContain(result.statusToken);
      expect(JSON.stringify(saved)).not.toContain(result.statusToken);

      const status = getQuestionStatusByToken(database.db, result.statusToken);
      expect(status).toMatchObject({
        state: "received",
        question: { id: result.id, content: "以后还能回来查看这个问题吗？" },
        answer: null,
        cards: [],
      });
      expect(`/status/${result.statusToken}`).not.toBe(`/status/${result.id}`);
    } finally {
      database.close();
    }
  });

  it("generates different secrets for different questions", async () => {
    const database = createTestDatabase();
    try {
      const first = await submitQuestion(database, "第一个状态链接");
      const second = await submitQuestion(database, "第二个状态链接");

      expect(first.statusToken).not.toBe(second.statusToken);
      expect(database.db.select().from(questions).all()).toHaveLength(2);
    } finally {
      database.close();
    }
  });

  it("does not query the database for malformed or oversized tokens", () => {
    const select = vi.fn(() => {
      throw new Error("database query must not run");
    });
    const database = { select } as unknown as Parameters<typeof getQuestionStatusByToken>[0];

    expect(getQuestionStatusByToken(database, "invalid!")).toBeNull();
    expect(getQuestionStatusByToken(database, "a".repeat(10_000))).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it("reads the persisted answer and existing share-card metadata", async () => {
    const database = createTestDatabase();
    try {
      const result = await submitQuestion(database);
      const answerResult = saveAnswer(database.db, {
        questionId: result.id,
        content: "可以，回答会从数据库读取。",
        now: new Date("2026-07-31T01:00:00.000Z"),
      });
      if (answerResult.kind !== "saved") throw new Error("answer was not saved");

      const renderer: ShareCardRenderer = {
        version: "status-test-renderer-v1",
        render: vi.fn(async () => ({
          bytes: new TextEncoder().encode("persisted card"),
          mimeType: "image/png" as const,
          pageNumber: 1,
          pageCount: 1,
        })),
      };
      const persistedQuestion = database.db.select().from(questions).get();
      if (!persistedQuestion) throw new Error("question was not persisted");
      await exportShareCard(
        database.db,
        {
          question: persistedQuestion,
          answer: answerResult.answer,
          aspect: "4:5",
          theme: "paper",
        },
        renderer,
      );

      const status = getQuestionStatusByToken(database.db, result.statusToken);
      expect(status).toMatchObject({
        state: "answered",
        answer: { content: "可以，回答会从数据库读取。" },
        cards: [{ aspect: "4:5", width: 1200, height: 1500 }],
      });
    } finally {
      database.close();
    }
  });

  it("does not grant status access to legacy questions without a token hash", () => {
    const database = createTestDatabase();
    try {
      const now = new Date("2026-07-30T00:00:00.000Z");
      database.db
        .insert(questions)
        .values({
          content: "迁移前的问题",
          ipHash: "a".repeat(64),
          userAgentHash: "b".repeat(64),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(getQuestionStatusByToken(database.db, generateStatusToken())).toBeNull();
    } finally {
      database.close();
    }
  });
});
