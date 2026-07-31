import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { answers, cards, questions } from "@/db/schema";
import { saveAnswer } from "@/services/answers";
import { exportShareCard } from "@/services/cards";
import type { ShareCardRenderer } from "@/services/share-card-renderer";

import { createTestDatabase } from "../helpers/database";

function insertQuestion(database: ReturnType<typeof createTestDatabase>) {
  const now = new Date("2026-07-18T00:00:00.000Z");
  return database.db
    .insert(questions)
    .values({
      content: "最喜欢怎样的傍晚？",
      ipHash: "a".repeat(64),
      userAgentHash: "b".repeat(64),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

describe("Answer and Card persistence", () => {
  it("upserts one answer per question and updates question state atomically", () => {
    const database = createTestDatabase();
    const question = insertQuestion(database);
    const first = saveAnswer(database.db, {
      questionId: question.id,
      content: "有风，也不太亮。",
      now: new Date("2026-07-18T01:00:00.000Z"),
    });
    const second = saveAnswer(database.db, {
      questionId: question.id,
      content: "有风，天色慢慢暗下来。",
      now: new Date("2026-07-18T02:00:00.000Z"),
    });

    expect(first.kind).toBe("saved");
    expect(second.kind).toBe("saved");
    expect(database.db.select().from(answers).all()).toHaveLength(1);
    expect(database.db.select().from(answers).get()?.content).toContain("慢慢暗下来");
    expect(database.db.select().from(questions).get()?.status).toBe("replied");
    database.close();
  });

  it("renders from persisted content and records reproducible image metadata", async () => {
    const database = createTestDatabase();
    const question = insertQuestion(database);
    const result = saveAnswer(database.db, {
      questionId: question.id,
      content: "纸张一样安静的傍晚。",
    });
    if (result.kind !== "saved") throw new Error("answer was not saved");
    const renderer: ShareCardRenderer = {
      version: "test-renderer-v1",
      render: vi.fn(async (input) => ({
        bytes: new TextEncoder().encode(`${input.data.question}\n${input.data.answer}`),
        mimeType: "image/png" as const,
        pageNumber: 1,
        pageCount: 1,
      })),
    };

    const exported = await exportShareCard(
      database.db,
      {
        question,
        answer: result.answer,
        aspect: "4:5",
        theme: "paper",
      },
      renderer,
    );

    expect(exported.card).toMatchObject({
      answerId: result.answer.id,
      aspect: "4:5",
      width: 1200,
      height: 1500,
      rendererVersion: "test-renderer-v1",
      pageNumber: 1,
      pageCount: 1,
    });
    expect(exported.card.contentHash).toHaveLength(64);
    expect(exported.card.byteSize).toBe(exported.bytes.byteLength);

    database.db.delete(questions).where(eq(questions.id, question.id)).run();
    expect(database.db.select().from(answers).all()).toHaveLength(0);
    expect(database.db.select().from(cards).all()).toHaveLength(0);
    database.close();
  });
});
