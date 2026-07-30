import type { NextRequest } from "next/server";

import { hmacHash } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

function cleanIp(value: string | null) {
  if (!value) return null;
  const ip = value.trim();
  if (!ip || ip.length > 64 || /[\r\n]/.test(ip)) return null;
  return ip;
}

export function getClientIp(request: NextRequest) {
  const env = getEnv();
  if (env.TRUST_CLOUDFLARE_PROXY) {
    const cloudflareIp = cleanIp(request.headers.get("cf-connecting-ip"));
    if (cloudflareIp) return cloudflareIp;
  }
  if (env.TRUST_PROXY) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
    return cleanIp(forwarded) ?? cleanIp(request.headers.get("x-real-ip")) ?? "unknown";
  }
  return process.env.NODE_ENV === "development" ? "127.0.0.1" : "unknown";
}

export function requestFingerprints(request: NextRequest) {
  const env = getEnv();
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return {
    ip,
    ipHash: hmacHash(ip, env.IP_HASH_SECRET),
    userAgentHash: hmacHash(userAgent, env.IP_HASH_SECRET),
  };
}

export function hasValidMutationOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
