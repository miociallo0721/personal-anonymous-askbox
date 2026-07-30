import { and, count, desc, eq, like, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { questions, questionStatuses } from "@/db/schema";
import { apiError, apiSuccess, authorizeAdmin, safeRouteError } from "@/lib/api";

const querySchema = z.object({
  status: z.enum(questionStatuses).optional(),
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
});

export async function GET(request: NextRequest) {
  try {
    const denied = await authorizeAdmin(request);
    if (denied) return denied;
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return apiError("筛选条件无效");
    const conditions: SQL[] = [];
    if (parsed.data.status) conditions.push(eq(questions.status, parsed.data.status));
    if (parsed.data.q) conditions.push(like(questions.content, `%${parsed.data.q}%`));
    const where = conditions.length ? and(...conditions) : undefined;
    const pageSize = 30;
    const total = db.select({ value: count() }).from(questions).where(where).get()?.value ?? 0;
    const items = db
      .select()
      .from(questions)
      .where(where)
      .orderBy(desc(questions.createdAt))
      .limit(pageSize)
      .offset((parsed.data.page - 1) * pageSize)
      .all();
    return apiSuccess({ items, total, page: parsed.data.page, pageSize });
  } catch (error) {
    return safeRouteError("admin-list-questions", error);
  }
}
