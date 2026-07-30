import { and, count, eq, gte } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { adminLoginAttempts } from "@/db/schema";
import { apiError, apiSuccess, safeRouteError } from "@/lib/api";
import { createAdminSession, setAdminSessionCookie, verifyAdminPassword } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { hasValidMutationOrigin, requestFingerprints } from "@/lib/request-security";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    if (!hasValidMutationOrigin(request)) return apiError("请求来源无效", 403);
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("请输入管理员密码", 400);
    const now = new Date();
    const { ipHash } = requestFingerprints(request);
    const recentFailures =
      db
        .select({ value: count() })
        .from(adminLoginAttempts)
        .where(
          and(
            eq(adminLoginAttempts.ipHash, ipHash),
            eq(adminLoginAttempts.succeeded, false),
            gte(adminLoginAttempts.createdAt, new Date(now.getTime() - 15 * 60_000)),
          ),
        )
        .get()?.value ?? 0;
    if (recentFailures >= 5) return apiError("登录尝试过多，请稍后再试", 429);

    const valid = verifyAdminPassword(parsed.data.password, getEnv().ADMIN_PASSWORD);
    db.insert(adminLoginAttempts).values({ ipHash, succeeded: valid, createdAt: now }).run();
    if (!valid) return apiError("密码错误", 401);
    const session = createAdminSession();
    const response = apiSuccess();
    setAdminSessionCookie(response, session);
    return response;
  } catch (error) {
    return safeRouteError("admin-login", error);
  }
}
