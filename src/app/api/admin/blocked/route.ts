import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { blockedSources, questions } from "@/db/schema";
import { apiError, apiSuccess, authorizeAdmin, safeRouteError } from "@/lib/api";

const blockSchema = z.object({
  ipHash: z.string().length(64),
  reason: z.string().trim().min(1).max(200).default("管理员封禁"),
});

export async function GET(request: NextRequest) {
  try {
    const denied = await authorizeAdmin(request);
    if (denied) return denied;
    const items = db.select().from(blockedSources).orderBy(desc(blockedSources.createdAt)).all();
    return apiSuccess({ items });
  } catch (error) {
    return safeRouteError("admin-list-blocked", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await authorizeAdmin(request, true);
    if (denied) return denied;
    const parsed = blockSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("封禁参数无效");
    db.insert(blockedSources)
      .values({ ...parsed.data, createdAt: new Date() })
      .onConflictDoUpdate({ target: blockedSources.ipHash, set: { reason: parsed.data.reason } })
      .run();
    db.update(questions)
      .set({ isBlocked: true, updatedAt: new Date() })
      .where(eq(questions.ipHash, parsed.data.ipHash))
      .run();
    return apiSuccess();
  } catch (error) {
    return safeRouteError("admin-block-source", error);
  }
}
