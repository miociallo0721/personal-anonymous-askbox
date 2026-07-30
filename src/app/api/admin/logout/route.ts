import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { apiError, apiSuccess, safeRouteError } from "@/lib/api";
import { clearAdminSessionCookie, destroyAdminSession, SESSION_COOKIE } from "@/lib/auth";
import { hasValidMutationOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  try {
    if (!hasValidMutationOrigin(request)) return apiError("请求来源无效", 403);
    destroyAdminSession(db, request.cookies.get(SESSION_COOKIE)?.value);
    const response = apiSuccess();
    clearAdminSessionCookie(response);
    return response;
  } catch (error) {
    return safeRouteError("admin-logout", error);
  }
}
