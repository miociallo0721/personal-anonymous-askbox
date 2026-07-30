import { describe, expect, it } from "vitest";

import { RATE_LIMITS, evaluateRateLimits } from "@/lib/rate-limit";

describe("数据库限流规则", () => {
  it("允许未达到阈值的来源", () => {
    const counts = RATE_LIMITS.map((item) => ({ windowMs: item.windowMs, count: 0 }));
    expect(evaluateRateLimits(counts).allowed).toBe(true);
  });

  it.each([
    [RATE_LIMITS[0].windowMs, 1],
    [RATE_LIMITS[1].windowMs, 5],
    [RATE_LIMITS[2].windowMs, 15],
  ])("在窗口 %i 达到 %i 条时拒绝", (windowMs, count) => {
    const result = evaluateRateLimits([{ windowMs, count }]);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});
