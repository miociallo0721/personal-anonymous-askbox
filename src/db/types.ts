import type { createDatabase } from "@/db/client";

export type DatabaseClient = ReturnType<typeof createDatabase>["db"];
