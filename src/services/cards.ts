import { eq } from "drizzle-orm";

import type { DatabaseClient } from "@/db/types";
import { answers, cards, questions } from "@/db/schema";
import {
  createShareCardRenderPlan,
  type ShareCardAspect,
  type ShareCardThemeName,
} from "@/lib/share-card";

export function getCardSource(database: DatabaseClient, questionId: number) {
  const row = database
    .select({
      answerId: answers.id,
      question: questions.content,
      answer: answers.content,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(eq(answers.questionId, questionId))
    .get();

  return row
    ? {
        answerId: row.answerId,
        data: { question: row.question.trim(), answer: row.answer.trim() },
      }
    : undefined;
}

export function createCardExport(
  database: DatabaseClient,
  input: {
    answerId: number;
    aspect: ShareCardAspect;
    theme: ShareCardThemeName;
    now?: Date;
  },
) {
  const plan = createShareCardRenderPlan(input.aspect, input.theme);
  const card = database
    .insert(cards)
    .values({
      answerId: input.answerId,
      aspect: input.aspect,
      theme: input.theme,
      imageFormat: plan.imageFormat,
      width: plan.width,
      height: plan.height,
      pageCount: plan.pageCount,
      rendererVersion: plan.rendererVersion,
      createdAt: input.now ?? new Date(),
    })
    .returning()
    .get();

  return { card, plan };
}
