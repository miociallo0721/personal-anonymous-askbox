import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

import { db } from "@/db/client";
import { adminSessions } from "@/db/schema";
import { hmacHash, safeEqual, sha256 } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "askbox_admin_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60_000;

function sessionHash(token: string) {
  const env = getEnv();
  return hmacHash(token, `${env.SESSION_SECRET}\0${sha256(env.ADMIN_PASSWORD)}`);
}

export function verifyAdminPassword(candidate: string, configuredPassword: string) {
  return safeEqual(candidate, configuredPassword);
}

export async function createAdminSession() {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  db.delete(adminSessions).where(lt(adminSessions.expiresAt, now)).run();
  db.insert(adminSessions)
    .values({ tokenHash: sessionHash(token), createdAt: now, expiresAt })
    .run();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token)
    db.delete(adminSessions)
      .where(eq(adminSessions.tokenHash, sessionHash(token)))
      .run();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function isAdminAuthenticated() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const now = new Date();
  const session = db
    .select({ id: adminSessions.id })
    .from(adminSessions)
    .where(and(eq(adminSessions.tokenHash, sessionHash(token)), gt(adminSessions.expiresAt, now)))
    .get();
  return Boolean(session);
}
