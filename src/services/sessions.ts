import { and, eq, gt } from "drizzle-orm";

import type { createDatabase } from "@/db/client";
import { adminSessions } from "@/db/schema";
import { hmacHash, sha256 } from "@/lib/crypto";

type DatabaseClient = ReturnType<typeof createDatabase>["db"];

export function sessionTokenHash(
  token: string,
  secrets: { sessionSecret: string; adminPassword: string },
) {
  return hmacHash(token, `${secrets.sessionSecret}\0${sha256(secrets.adminPassword)}`);
}

export function storeAdminSession(
  database: DatabaseClient,
  input: {
    token: string;
    createdAt: Date;
    expiresAt: Date;
    sessionSecret: string;
    adminPassword: string;
  },
) {
  return database
    .insert(adminSessions)
    .values({
      tokenHash: sessionTokenHash(input.token, input),
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
    })
    .returning()
    .get();
}

export function hasValidAdminSession(
  database: DatabaseClient,
  input: {
    token: string;
    now: Date;
    sessionSecret: string;
    adminPassword: string;
  },
) {
  const session = database
    .select({ id: adminSessions.id })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, sessionTokenHash(input.token, input)),
        gt(adminSessions.expiresAt, input.now),
      ),
    )
    .get();
  return Boolean(session);
}

export function deleteAdminSession(
  database: DatabaseClient,
  input: {
    token: string;
    sessionSecret: string;
    adminPassword: string;
  },
) {
  return database
    .delete(adminSessions)
    .where(eq(adminSessions.tokenHash, sessionTokenHash(input.token, input)))
    .run();
}
