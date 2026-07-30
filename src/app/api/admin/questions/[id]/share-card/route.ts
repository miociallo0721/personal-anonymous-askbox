import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ShareCard } from "@/components/share-card";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { apiError, authorizeAdmin, safeRouteError } from "@/lib/api";
import { SHARE_CARD_ASPECTS, SHARE_CARD_FORMATS, SHARE_CARD_THEME_NAMES } from "@/lib/share-card";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

const requestSchema = z.object({
  answer: z.string().trim().min(2).max(600),
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

    const question = db
      .select({
        id: questions.id,
        content: questions.content,
        status: questions.status,
      })
      .from(questions)
      .where(eq(questions.id, id.data))
      .get();
    if (!question) return apiError("问题不存在", 404);
    if (question.status !== "replied") return apiError("仅已回复的问题可以生成分享卡片", 409);

    const format = SHARE_CARD_FORMATS[body.data.aspect];
    const filename = `askbox-${question.id}-${body.data.aspect.replace(":", "x")}.png`;

    return new ImageResponse(
      ShareCard({
        data: {
          question: question.content.trim(),
          answer: body.data.answer,
        },
        aspect: body.data.aspect,
        themeName: body.data.theme,
      }),
      {
        width: format.width,
        height: format.height,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return safeRouteError("admin-share-card", error);
  }
}
