import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { apiError, apiSuccess, safeRouteError } from "@/lib/api";
import { protectPrivateStatusResponse } from "@/lib/status-response";
import { consumeStatusAccess } from "@/services/status-access";
import { getQuestionStatusByToken } from "@/services/question-status";

type Context = { params: Promise<{ token: string }> };

function invalidResponse() {
  return protectPrivateStatusResponse(apiError("链接无效或已失效", 404));
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const rateLimit = consumeStatusAccess(request.headers);
    if (!rateLimit.allowed) {
      const response = apiError("请求过于频繁，请稍后再试", 429);
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
      return protectPrivateStatusResponse(response);
    }

    const status = getQuestionStatusByToken(db, (await context.params).token);
    if (!status) return invalidResponse();

    return protectPrivateStatusResponse(
      apiSuccess({
        status: {
          state: status.state,
          submittedAt: status.question.createdAt.toISOString(),
          repliedAt:
            status.state === "answered"
              ? (status.question.repliedAt ?? status.answer?.updatedAt)?.toISOString()
              : null,
          question: status.state === "answered" ? status.question.content : null,
          answer: status.answer?.content ?? null,
          cards: status.cards.map((card) => ({
            aspect: card.aspect,
            width: card.width,
            height: card.height,
            createdAt: card.createdAt.toISOString(),
          })),
        },
      }),
    );
  } catch (error) {
    return protectPrivateStatusResponse(safeRouteError("question-status", error));
  }
}
