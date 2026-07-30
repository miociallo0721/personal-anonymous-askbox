import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { apiError, apiSuccess, authorizeAdmin, safeRouteError } from "@/lib/api";
import { answerContentSchema, idSchema } from "@/lib/validation";
import { getAnswerForQuestion, saveAnswer } from "@/services/answers";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const denied = await authorizeAdmin(request);
    if (denied) return denied;
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return apiError("问题编号无效");
    const answer = getAnswerForQuestion(db, id.data);
    return apiSuccess({ answer: answer ?? null });
  } catch (error) {
    return safeRouteError("admin-get-answer", error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const denied = await authorizeAdmin(request, true);
    if (denied) return denied;
    const [id, body] = [
      idSchema.safeParse((await context.params).id),
      answerContentSchema.safeParse((await request.json().catch(() => null))?.content),
    ];
    if (!id.success || !body.success) {
      return apiError(
        body.success ? "问题编号无效" : (body.error.issues[0]?.message ?? "回答无效"),
      );
    }
    const result = saveAnswer(db, id.data, body.data);
    if (result.kind === "question-not-found") return apiError("问题不存在", 404);
    return apiSuccess({ answer: result.answer });
  } catch (error) {
    return safeRouteError("admin-save-answer", error);
  }
}
