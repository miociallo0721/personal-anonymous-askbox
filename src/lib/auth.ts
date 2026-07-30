import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { db } from "@/db/client";
import { adminSessions } from "@/db/schema";
import type { DatabaseClient } from "@/db/types";
import { hmacHash, safeEqual, sha256 } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "askbox_admin_session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60_000;

function sessionHash(token: string) {
  const env = getEnv();
  return hmacHash(token, `${env.SESSION_SECRET}\0${sha256(env.ADMIN_PASSWORD)}`);
}

export function verifyAdminPassword(candidate: string, configuredPassword: string) {
  return safeEqual(candidate, configuredPassword);
}

export function createAdminSession(
  database: DatabaseClient = db,
  now = new Date(),
  token = randomBytes(32).toString("base64url"),
) {
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  database
    .insert(adminSessions)
    .values({ tokenHash: sessionHash(token), createdAt: now, expiresAt })
    .run();
  return { token, expiresAt };
}

export function setAdminSessionCookie(
  response: NextResponse,
  session: ReturnType<typeof createAdminSession>,
) {
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: session.expiresAt,
    priority: "high",
  });
}

export function destroyAdminSession(database: DatabaseClient, token?: string) {
  if (token)
    database
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, sessionHash(token)))
      .run();
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function validateAdminSession(
  database: DatabaseClient,
  token: string | undefined,
  now = new Date(),
) {
  if (!token) return false;
  const session = database
    .select({ id: adminSessions.id })
    .from(adminSessions)
    .where(and(eq(adminSessions.tokenHash, sessionHash(token)), gt(adminSessions.expiresAt, now)))
    .get();
  return Boolean(session);
}

export function isAdminRequestAuthenticated(request: NextRequest) {
  return validateAdminSession(db, request.cookies.get(SESSION_COOKIE)?.value);
}

export async function isAdminAuthenticated() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return validateAdminSession(db, token);
}
