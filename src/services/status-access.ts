import { hmacHash } from "@/lib/crypto";
import { getEnv } from "@/lib/env";
import { getClientIpFromHeaders } from "@/lib/request-security";
import {
  consumeStatusImageRateLimit,
  consumeStatusRateLimit,
  type StatusRateLimitResult,
} from "@/lib/status-rate-limit";

type HeaderReader = Pick<Headers, "get">;

export function consumeStatusAccess(
  headers: HeaderReader,
  kind: "page" | "image" = "page",
  now?: number,
): StatusRateLimitResult {
  const env = getEnv();
  const ip = getClientIpFromHeaders(headers);
  const key = hmacHash(ip, env.IP_HASH_SECRET);
  return kind === "image"
    ? consumeStatusImageRateLimit(key, now)
    : consumeStatusRateLimit(key, now);
}
