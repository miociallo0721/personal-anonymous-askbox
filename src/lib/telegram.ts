import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Question } from "@/db/schema";
import { questions } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { formatShanghaiTime } from "@/lib/time";

type DatabaseClient = typeof import("@/db/client").db;

const telegramResponse = z.object({
  ok: z.boolean(),
  result: z.object({ message_id: z.number() }).optional(),
  description: z.string().optional(),
});

function errorSummary(error: unknown) {
  const message = error instanceof Error ? error.message : "未知错误";
  return message.replace(/[\r\n]+/g, " ").slice(0, 300);
}

export async function sendQuestionToTelegram(question: Question, database: DatabaseClient) {
  const env = getEnv();
  const now = new Date();
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.ADMIN_PUBLIC_URL) {
    const error = "Telegram 未完整配置";
    await database
      .update(questions)
      .set({ telegramError: error, updatedAt: now })
      .where(eq(questions.id, question.id));
    return { success: false as const, error };
  }

  const adminUrl = new URL(env.ADMIN_PUBLIC_URL);
  adminUrl.searchParams.set("question", String(question.id));
  adminUrl.hash = `question-${question.id}`;
  const maxContentLength = 3500;
  const content =
    question.content.length > maxContentLength
      ? `${question.content.slice(0, maxContentLength)}…`
      : question.content;
  const text = `📨 新的匿名提问 #${question.id}\n\n${content}\n\n时间：${formatShanghaiTime(question.createdAt)}`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          reply_markup: { inline_keyboard: [[{ text: "打开后台", url: adminUrl.toString() }]] },
        }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    const parsed = telegramResponse.safeParse(await response.json());
    if (!response.ok || !parsed.success || !parsed.data.ok || !parsed.data.result) {
      const description = parsed.success ? parsed.data.description : "Telegram 返回格式异常";
      throw new Error(description ?? `Telegram HTTP ${response.status}`);
    }
    const messageId = parsed.data.result.message_id;
    await database
      .update(questions)
      .set({
        telegramNotified: true,
        telegramMessageId: messageId,
        telegramError: null,
        updatedAt: now,
      })
      .where(eq(questions.id, question.id));
    return { success: true as const, messageId };
  } catch (error) {
    const summary = errorSummary(error);
    await database
      .update(questions)
      .set({ telegramNotified: false, telegramError: summary, updatedAt: now })
      .where(eq(questions.id, question.id));
    return { success: false as const, error: summary };
  }
}
