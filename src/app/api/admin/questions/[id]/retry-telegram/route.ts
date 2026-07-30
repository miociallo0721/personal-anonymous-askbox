import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { apiError, apiSuccess, authorizeAdmin, safeRouteError } from "@/lib/api";
import { sendQuestionToTelegram } from "@/lib/telegram";
import { idSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const denied = await authorizeAdmin(request, true);
    if (denied) return denied;
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return apiError("问题编号无效");
    const question = db.select().from(questions).where(eq(questions.id, id.data)).get();
    if (!question) return apiError("问题不存在", 404);
    const result = await sendQuestionToTelegram(question, db);
    if (!result.success) return apiError(`发送失败：${result.error}`, 502);
    return apiSuccess({ messageId: result.messageId });
  } catch (error) {
    return safeRouteError("admin-retry-telegram", error);
  }
}
