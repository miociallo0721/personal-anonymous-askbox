import { NextResponse, type NextRequest } from "next/server";

import { isAdminRequestAuthenticated } from "@/lib/auth";
import { errorMessage, logger } from "@/lib/logger";
import { hasValidMutationOrigin } from "@/lib/request-security";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function apiSuccess<T extends Record<string, unknown>>(data?: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export async function authorizeAdmin(request: NextRequest, mutation = false) {
  if (mutation && !hasValidMutationOrigin(request)) return apiError("请求来源无效", 403);
  if (!isAdminRequestAuthenticated(request)) return apiError("未登录或会话已过期", 401);
  return null;
}

export function safeRouteError(context: string, error: unknown) {
  logger.error("api.unhandled_error", { context, error: errorMessage(error) });
  return apiError("服务器暂时无法处理请求", 500);
}
