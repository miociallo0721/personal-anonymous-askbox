import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ShareCard } from "@/components/share-card";
import { db } from "@/db/client";
import { apiError, authorizeAdmin, safeRouteError } from "@/lib/api";
import {
  createShareCardRenderPlan,
  SHARE_CARD_ASPECTS,
  SHARE_CARD_THEME_NAMES,
} from "@/lib/share-card";
import { idSchema } from "@/lib/validation";
import { createCardExport, getCardSource } from "@/services/cards";

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

    const source = getCardSource(db, id.data);
    if (!source) return apiError("请先保存回答，再生成分享卡片", 409);

    const plan = createShareCardRenderPlan(body.data.aspect, body.data.theme);
    const filename = `askbox-${id.data}-${body.data.aspect.replace(":", "x")}.png`;
    const response = new ImageResponse(
      ShareCard({
        data: source.data,
        aspect: body.data.aspect,
        themeName: body.data.theme,
      }),
      {
        width: plan.width,
        height: plan.height,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
    const { card } = createCardExport(db, {
      answerId: source.answerId,
      aspect: body.data.aspect,
      theme: body.data.theme,
    });
    response.headers.set("X-Askbox-Card-Id", String(card.id));
    return response;
  } catch (error) {
    return safeRouteError("admin-share-card", error);
  }
}
