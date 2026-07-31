import { desc, eq } from "drizzle-orm";

import type { createDatabase } from "@/db/client";
import { answers, cards, questions } from "@/db/schema";
import { hashStatusToken } from "@/lib/status-token";
import { statusTokenSchema } from "@/lib/validation";

type DatabaseClient = ReturnType<typeof createDatabase>["db"];

export type QuestionStatusCard = {
  aspect: (typeof cards.$inferSelect)["aspect"];
  width: number;
  height: number;
  createdAt: Date;
};

export type PrivateQuestionStatus = {
  state: "received" | "answered";
  question: {
    id: number;
    content: string;
    createdAt: Date;
    repliedAt: Date | null;
  };
  answer: {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  cards: QuestionStatusCard[];
};

export function getQuestionStatusByToken(
  database: DatabaseClient,
  token: string,
): PrivateQuestionStatus | null {
  const parsed = statusTokenSchema.safeParse(token);
  if (!parsed.success) return null;

  const result = database
    .select({
      question: {
        id: questions.id,
        content: questions.content,
        createdAt: questions.createdAt,
        repliedAt: questions.repliedAt,
      },
      answer: {
        id: answers.id,
        content: answers.content,
        createdAt: answers.createdAt,
        updatedAt: answers.updatedAt,
      },
    })
    .from(questions)
    .leftJoin(answers, eq(answers.questionId, questions.id))
    .where(eq(questions.statusTokenHash, hashStatusToken(parsed.data)))
    .get();
  if (!result) return null;

  const answer = result.answer?.id ? result.answer : null;
  if (!answer) {
    return {
      state: "received",
      question: result.question,
      answer: null,
      cards: [],
    };
  }

  const latestByAspect = new Map<QuestionStatusCard["aspect"], QuestionStatusCard>();
  for (const card of database
    .select({
      aspect: cards.aspect,
      width: cards.width,
      height: cards.height,
      createdAt: cards.createdAt,
    })
    .from(cards)
    .where(eq(cards.answerId, answer.id))
    .orderBy(desc(cards.createdAt))
    .all()) {
    if (!latestByAspect.has(card.aspect)) latestByAspect.set(card.aspect, card);
  }

  return {
    state: "answered",
    question: result.question,
    answer,
    cards: [...latestByAspect.values()],
  };
}
