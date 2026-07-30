import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { answers, questions, questionStatuses } from "@/db/schema";
import { apiError, apiSuccess, authorizeAdmin, safeRouteError } from "@/lib/api";
import { idSchema } from "@/lib/validation";

const statusSchema = z.object({ status: z.enum(questionStatuses) });
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const denied = await authorizeAdmin(request);
    if (denied) return denied;
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return apiError("问题编号无效");
    const item = db.select().from(questions).where(eq(questions.id, id.data)).get();
    if (!item) return apiError("问题不存在", 404);
    return apiSuccess({ item });
  } catch (error) {
    return safeRouteError("admin-get-question", error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const denied = await authorizeAdmin(request, true);
    if (denied) return denied;
    const [id, body] = [
      idSchema.safeParse((await context.params).id),
      statusSchema.safeParse(await request.json()),
    ];
    if (!id.success || !body.success) return apiError("请求参数无效");
    if (body.data.status === "replied") {
      const answer = db
        .select({ id: answers.id })
        .from(answers)
        .where(eq(answers.questionId, id.data))
        .get();
      if (!answer) return apiError("请先保存回答，再标记为已回复", 409);
    }
    const now = new Date();
    const updated = db
      .update(questions)
      .set({
        status: body.data.status,
        updatedAt: now,
        repliedAt: body.data.status === "replied" ? now : null,
      })
      .where(eq(questions.id, id.data))
      .returning()
      .get();
    if (!updated) return apiError("问题不存在", 404);
    return apiSuccess({ item: updated });
  } catch (error) {
    return safeRouteError("admin-update-question", error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const denied = await authorizeAdmin(request, true);
    if (denied) return denied;
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return apiError("问题编号无效");
    const deleted = db
      .delete(questions)
      .where(eq(questions.id, id.data))
      .returning({ id: questions.id })
      .get();
    if (!deleted) return apiError("问题不存在", 404);
    return apiSuccess();
  } catch (error) {
    return safeRouteError("admin-delete-question", error);
  }
}
