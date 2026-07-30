import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { answers, cards, questions } from "@/db/schema";
import { saveAnswer } from "@/services/answers";
import { createCardExport, getCardSource } from "@/services/cards";
import { createMigratedTestDatabase } from "../helpers/database";

function insertQuestion(
  database: ReturnType<typeof createMigratedTestDatabase>["db"],
  content = "数据库升级后，旧问题还在吗？",
) {
  const now = new Date("2026-07-30T10:00:00.000Z");
  return database
    .insert(questions)
    .values({
      content,
      ipHash: "a".repeat(64),
      userAgentHash: "b".repeat(64),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

describe("Answer 与 Card 数据模型", () => {
  it("保存回答时创建 Answer 并原子更新问题状态", () => {
    const database = createMigratedTestDatabase();
    const question = insertQuestion(database.db);
    const createdAt = new Date("2026-07-30T10:10:00.000Z");

    const result = saveAnswer(database.db, question.id, "旧问题会保留，回答会持久化。", createdAt);
    expect(result.kind).toBe("saved");
    expect(database.db.select().from(answers).all()).toHaveLength(1);
    expect(
      database.db.select().from(questions).where(eq(questions.id, question.id)).get(),
    ).toMatchObject({ status: "replied", repliedAt: createdAt });
    database.close();
  });

  it("更新回答保留 Answer 标识与首次创建时间", () => {
    const database = createMigratedTestDatabase();
    const question = insertQuestion(database.db);
    const first = saveAnswer(
      database.db,
      question.id,
      "第一版回答",
      new Date("2026-07-30T10:10:00.000Z"),
    );
    const second = saveAnswer(
      database.db,
      question.id,
      "第二版回答",
      new Date("2026-07-30T10:20:00.000Z"),
    );

    expect(first.kind).toBe("saved");
    expect(second.kind).toBe("saved");
    if (first.kind === "saved" && second.kind === "saved") {
      expect(second.answer.id).toBe(first.answer.id);
      expect(second.answer.createdAt).toEqual(first.answer.createdAt);
      expect(second.answer.updatedAt).not.toEqual(first.answer.updatedAt);
    }
    expect(database.db.select().from(answers).all()).toHaveLength(1);
    database.close();
  });

  it("卡片只引用持久化 Answer，并保存可重放的渲染元数据", () => {
    const database = createMigratedTestDatabase();
    const question = insertQuestion(database.db);
    const answer = saveAnswer(database.db, question.id, "这是持久化回答。");
    expect(answer.kind).toBe("saved");
    if (answer.kind !== "saved") throw new Error("answer not saved");

    const source = getCardSource(database.db, question.id);
    expect(source?.data).toEqual({
      question: "数据库升级后，旧问题还在吗？",
      answer: "这是持久化回答。",
    });
    const exported = createCardExport(database.db, {
      answerId: answer.answer.id,
      aspect: "4:5",
      theme: "paper",
      now: new Date("2026-07-30T10:30:00.000Z"),
    });
    expect(exported.card).toMatchObject({
      answerId: answer.answer.id,
      aspect: "4:5",
      imageFormat: "png",
      width: 1200,
      height: 1500,
      pageCount: 1,
      rendererVersion: 1,
    });

    database.db.delete(questions).where(eq(questions.id, question.id)).run();
    expect(database.db.select().from(answers).all()).toHaveLength(0);
    expect(database.db.select().from(cards).all()).toHaveLength(0);
    database.close();
  });
});
