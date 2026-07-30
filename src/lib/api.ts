import { NextResponse, type NextRequest } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { hasValidMutationOrigin } from "@/lib/request-security";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function apiSuccess<T extends Record<string, unknown>>(data?: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export async function authorizeAdmin(request: NextRequest, mutation = false) {
  if (mutation && !hasValidMutationOrigin(request)) return apiError("请求来源无效", 403);
  if (!(await isAdminAuthenticated())) return apiError("未登录或会话已过期", 401);
  return null;
}

export function safeRouteError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  console.error(`[${context}] ${message.slice(0, 300)}`);
  return apiError("服务器暂时无法处理请求", 500);
}
