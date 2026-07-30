import { database } from "@/db/client";
import { apiSuccess } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    database.sqlite.prepare("select 1").get();
    return apiSuccess({ status: "healthy" });
  } catch {
    return Response.json({ ok: false, status: "unhealthy" }, { status: 503 });
  }
}
