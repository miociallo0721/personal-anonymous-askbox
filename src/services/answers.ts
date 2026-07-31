import { eq } from "drizzle-orm";

import type { createDatabase } from "@/db/client";
import { answers, questions } from "@/db/schema";

type DatabaseClient = ReturnType<typeof createDatabase>["db"];

export type SaveAnswerInput = {
  questionId: number;
  content: string;
  now?: Date;
};

export type SaveAnswerResult =
  { kind: "saved"; answer: typeof answers.$inferSelect } | { kind: "not-found" };

export function getAnswerForQuestion(database: DatabaseClient, questionId: number) {
  return database.select().from(answers).where(eq(answers.questionId, questionId)).get();
}

export function saveAnswer(database: DatabaseClient, input: SaveAnswerInput): SaveAnswerResult {
  const now = input.now ?? new Date();

  return database.transaction((tx) => {
    const question = tx
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, input.questionId))
      .get();
    if (!question) return { kind: "not-found" as const };

    const answer = tx
      .insert(answers)
      .values({
        questionId: input.questionId,
        content: input.content,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: answers.questionId,
        set: { content: input.content, updatedAt: now },
      })
      .returning()
      .get();

    tx.update(questions)
      .set({ status: "replied", repliedAt: now, updatedAt: now })
      .where(eq(questions.id, input.questionId))
      .run();

    return { kind: "saved" as const, answer };
  });
}
