import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { blockedSources, questions } from "@/db/schema";
import { apiError, apiSuccess, authorizeAdmin, safeRouteError } from "@/lib/api";
import { idSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const denied = await authorizeAdmin(request, true);
    if (denied) return denied;
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return apiError("封禁编号无效");
    const source = db.select().from(blockedSources).where(eq(blockedSources.id, id.data)).get();
    if (!source) return apiError("封禁记录不存在", 404);
    db.transaction((tx) => {
      tx.delete(blockedSources).where(eq(blockedSources.id, source.id)).run();
      tx.update(questions)
        .set({ isBlocked: false, updatedAt: new Date() })
        .where(eq(questions.ipHash, source.ipHash))
        .run();
    });
    return apiSuccess();
  } catch (error) {
    return safeRouteError("admin-unblock-source", error);
  }
}
