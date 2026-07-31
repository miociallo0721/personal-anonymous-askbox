import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { answers, questions } from "@/db/schema";
import { apiError, authorizeAdmin, safeRouteError } from "@/lib/api";
import { SHARE_CARD_ASPECTS, SHARE_CARD_THEME_NAMES } from "@/lib/share-card";
import { idSchema } from "@/lib/validation";
import { exportShareCard } from "@/services/cards";

export const runtime = "nodejs";

const requestSchema = z.object({
  aspect: z.enum(SHARE_CARD_ASPECTS),
  theme: z.enum(SHARE_CARD_THEME_NAMES).default("paper"),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const denied = await authorizeAdmin(request, true);
    if (denied) return denied;

    const [id, body] = [
      idSchema.safeParse((await context.params).id),
      requestSchema.safeParse(await request.json().catch(() => null)),
    ];
    if (!id.success || !body.success) return apiError("分享卡片参数无效");

    const result = db
      .select({
        question: {
          id: questions.id,
          content: questions.content,
        },
        answer: {
          id: answers.id,
          content: answers.content,
        },
      })
      .from(questions)
      .innerJoin(answers, eq(answers.questionId, questions.id))
      .where(eq(questions.id, id.data))
      .get();
    if (!result) return apiError("请先保存回答", 409);

    const exported = await exportShareCard(db, {
      question: result.question,
      answer: result.answer,
      aspect: body.data.aspect,
      theme: body.data.theme,
    });
    const filename = `askbox-${result.question.id}-${body.data.aspect.replace(":", "x")}.png`;
    const responseBody = Uint8Array.from(exported.bytes).buffer;

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": exported.mimeType,
        "Content-Length": String(exported.bytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return safeRouteError("admin-share-card", error);
  }
}
