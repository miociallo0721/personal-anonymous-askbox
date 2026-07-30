import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { apiSuccess, authorizeAdmin, safeRouteError } from "@/lib/api";

export async function DELETE(request: NextRequest) {
  try {
    const denied = await authorizeAdmin(request, true);
    if (denied) return denied;
    const result = db.delete(questions).where(eq(questions.status, "spam")).run();
    return apiSuccess({ deleted: result.changes });
  } catch (error) {
    return safeRouteError("admin-delete-spam", error);
  }
}
