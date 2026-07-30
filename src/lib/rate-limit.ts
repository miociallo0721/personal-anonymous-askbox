export const RATE_LIMITS = [
  { windowMs: 60_000, maximum: 1, label: "每分钟" },
  { windowMs: 60 * 60_000, maximum: 5, label: "每小时" },
  { windowMs: 24 * 60 * 60_000, maximum: 15, label: "每天" },
] as const;

export type RateCounts = { windowMs: number; count: number }[];

export function evaluateRateLimits(counts: RateCounts) {
  for (const limit of RATE_LIMITS) {
    const count = counts.find((item) => item.windowMs === limit.windowMs)?.count ?? 0;
    if (count >= limit.maximum) {
      return { allowed: false as const, retryAfterSeconds: Math.ceil(limit.windowMs / 1000) };
    }
  }
  return { allowed: true as const, retryAfterSeconds: 0 };
}
