import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

import { db } from "@/db/client";
import { safeEqual } from "@/lib/crypto";
import { getEnv } from "@/lib/env";
import { deleteAdminSession, hasValidAdminSession, storeAdminSession } from "@/services/sessions";

export const SESSION_COOKIE = "askbox_admin_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60_000;

export function verifyAdminPassword(candidate: string, configuredPassword: string) {
  return safeEqual(candidate, configuredPassword);
}

export async function createAdminSession() {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const env = getEnv();
  storeAdminSession(db, {
    token,
    createdAt: now,
    expiresAt,
    sessionSecret: env.SESSION_SECRET,
    adminPassword: env.ADMIN_PASSWORD,
  });
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
  const env = getEnv();
  if (token) {
    deleteAdminSession(db, {
      token,
      sessionSecret: env.SESSION_SECRET,
      adminPassword: env.ADMIN_PASSWORD,
    });
  }
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
  const env = getEnv();
  return hasValidAdminSession(db, {
    token,
    now: new Date(),
    sessionSecret: env.SESSION_SECRET,
    adminPassword: env.ADMIN_PASSWORD,
  });
}
