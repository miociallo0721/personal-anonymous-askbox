import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { apiError, apiSuccess, safeRouteError } from "@/lib/api";
import { hasValidMutationOrigin, requestFingerprints } from "@/lib/request-security";
import { verifyTurnstile } from "@/lib/turnstile";
import { submitQuestionSchema } from "@/lib/validation";
import { saveQuestion } from "@/services/submission";

export async function POST(request: NextRequest) {
  try {
    if (!hasValidMutationOrigin(request)) return apiError("请求来源无效", 403);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 32_768) return apiError("请求内容过大", 413);

    const parsed = submitQuestionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "问题内容无效", 400);
    }
    if (parsed.data.website) return apiSuccess({ message: "已经收到" });

    const fingerprints = requestFingerprints(request);
    const turnstileValid = await verifyTurnstile(parsed.data.turnstileToken, fingerprints.ip);
    if (!turnstileValid) return apiError("人机验证失败，请刷新后重试", 400);

    const result = await saveQuestion(db, {
      content: parsed.data.content,
      ipHash: fingerprints.ipHash,
      userAgentHash: fingerprints.userAgentHash,
    });
    if (result.kind === "rate-limited") {
      return apiError("提交得有些快，请稍后再试", 429);
    }
    return apiSuccess({ message: "已经收到" }, 201);
  } catch (error) {
    return safeRouteError("submit-question", error);
  }
}
