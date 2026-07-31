import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { apiError, safeRouteError } from "@/lib/api";
import { SHARE_CARD_ASPECTS } from "@/lib/share-card";
import { PRIVATE_STATUS_HEADERS, protectPrivateStatusResponse } from "@/lib/status-response";
import { renderShareCard } from "@/services/cards";
import { getQuestionStatusByToken } from "@/services/question-status";
import { consumeStatusAccess } from "@/services/status-access";

export const runtime = "nodejs";

type Context = { params: Promise<{ token: string }> };

const querySchema = z.object({
  aspect: z.enum(SHARE_CARD_ASPECTS),
  download: z.enum(["0", "1"]).default("0"),
});

export async function GET(request: NextRequest, context: Context) {
  try {
    const rateLimit = consumeStatusAccess(request.headers, "image");
    if (!rateLimit.allowed) {
      return protectPrivateStatusResponse(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }),
      );
    }

    const query = querySchema.safeParse({
      aspect: request.nextUrl.searchParams.get("aspect"),
      download: request.nextUrl.searchParams.get("download") ?? "0",
    });
    if (!query.success) {
      return protectPrivateStatusResponse(apiError("分享卡片参数无效"));
    }

    const status = getQuestionStatusByToken(db, (await context.params).token);
    const card = status?.cards.find((item) => item.aspect === query.data.aspect);
    if (!status || !status.answer || !card) {
      return protectPrivateStatusResponse(apiError("链接无效或已失效", 404));
    }

    const rendered = await renderShareCard({
      question: status.question,
      answer: status.answer,
      aspect: query.data.aspect,
      theme: "paper",
    });
    const disposition = query.data.download === "1" ? "attachment" : "inline";

    return new Response(Uint8Array.from(rendered.bytes).buffer, {
      status: 200,
      headers: {
        ...PRIVATE_STATUS_HEADERS,
        "Content-Type": rendered.mimeType,
        "Content-Length": String(rendered.bytes.byteLength),
        "Content-Disposition": `${disposition}; filename="askbox-${query.data.aspect.replace(":", "x")}.png"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return protectPrivateStatusResponse(safeRouteError("question-status-card", error));
  }
}
