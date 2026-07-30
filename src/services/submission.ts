import { and, count, eq, gte } from "drizzle-orm";

import type { createDatabase } from "@/db/client";
import { blockedSources, questions, type Question } from "@/db/schema";
import { RATE_LIMITS, evaluateRateLimits } from "@/lib/rate-limit";
import { assessSpam } from "@/lib/spam";
import { sendQuestionToTelegram } from "@/lib/telegram";

type DatabaseClient = ReturnType<typeof createDatabase>["db"];
type Notify = (question: Question, database: DatabaseClient) => Promise<unknown>;

export type SubmissionInput = {
  content: string;
  ipHash: string;
  userAgentHash: string;
  now?: Date;
};

export type SubmissionResult =
  | { kind: "saved"; id: number }
  | { kind: "silent" }
  | { kind: "rate-limited"; retryAfterSeconds: number };

export async function saveQuestion(
  database: DatabaseClient,
  input: SubmissionInput,
  notify: Notify = sendQuestionToTelegram,
): Promise<SubmissionResult> {
  const now = input.now ?? new Date();

  const outcome = database.transaction((tx) => {
    const blocked = tx
      .select({ id: blockedSources.id })
      .from(blockedSources)
      .where(eq(blockedSources.ipHash, input.ipHash))
      .get();
    if (blocked) return { kind: "silent" as const };

    const counts = RATE_LIMITS.map((limit) => ({
      windowMs: limit.windowMs,
      count:
        tx
          .select({ value: count() })
          .from(questions)
          .where(
            and(
              eq(questions.ipHash, input.ipHash),
              gte(questions.createdAt, new Date(now.getTime() - limit.windowMs)),
            ),
          )
          .get()?.value ?? 0,
    }));
    const limit = evaluateRateLimits(counts);
    if (!limit.allowed) {
      return { kind: "rate-limited" as const, retryAfterSeconds: limit.retryAfterSeconds };
    }

    const duplicate = tx
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(
          eq(questions.ipHash, input.ipHash),
          eq(questions.content, input.content),
          gte(questions.createdAt, new Date(now.getTime() - 10 * 60_000)),
        ),
      )
      .get();
    const assessment = assessSpam(input.content, Boolean(duplicate));
    if (assessment.action === "discard") return { kind: "silent" as const };

    const created = tx
      .insert(questions)
      .values({
        content: input.content,
        status: assessment.action === "mark-spam" ? "spam" : "unread",
        ipHash: input.ipHash,
        userAgentHash: input.userAgentHash,
        spamScore: assessment.score,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    return { kind: "saved" as const, question: created };
  });

  if (outcome.kind !== "saved") return outcome;
  try {
    await notify(outcome.question, database);
  } catch (error) {
    const summary = (error instanceof Error ? error.message : "通知服务异常")
      .replace(/[\r\n]+/g, " ")
      .slice(0, 300);
    database
      .update(questions)
      .set({ telegramNotified: false, telegramError: summary, updatedAt: new Date() })
      .where(eq(questions.id, outcome.question.id))
      .run();
  }
  return { kind: "saved", id: outcome.question.id };
}
