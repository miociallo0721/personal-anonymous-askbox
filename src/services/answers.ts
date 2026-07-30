import { eq } from "drizzle-orm";

import type { DatabaseClient } from "@/db/types";
import { answers, questions, type Answer } from "@/db/schema";

export type SaveAnswerResult = { kind: "saved"; answer: Answer } | { kind: "question-not-found" };

export function saveAnswer(
  database: DatabaseClient,
  questionId: number,
  content: string,
  now = new Date(),
): SaveAnswerResult {
  return database.transaction((tx) => {
    const question = tx
      .select({ id: questions.id, repliedAt: questions.repliedAt })
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();
    if (!question) return { kind: "question-not-found" as const };

    const answer = tx
      .insert(answers)
      .values({ questionId, content, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: answers.questionId,
        set: { content, updatedAt: now },
      })
      .returning()
      .get();

    tx.update(questions)
      .set({
        status: "replied",
        repliedAt: question.repliedAt ?? now,
        updatedAt: now,
      })
      .where(eq(questions.id, questionId))
      .run();

    return { kind: "saved" as const, answer };
  });
}

export function getAnswerForQuestion(database: DatabaseClient, questionId: number) {
  return database.select().from(answers).where(eq(answers.questionId, questionId)).get();
}
