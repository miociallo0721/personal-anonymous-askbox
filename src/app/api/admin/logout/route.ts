import type { NextRequest } from "next/server";

import { apiError, apiSuccess, safeRouteError } from "@/lib/api";
import { destroyAdminSession } from "@/lib/auth";
import { hasValidMutationOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  try {
    if (!hasValidMutationOrigin(request)) return apiError("请求来源无效", 403);
    await destroyAdminSession();
    return apiSuccess();
  } catch (error) {
    return safeRouteError("admin-logout", error);
  }
}
