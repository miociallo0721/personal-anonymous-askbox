import { describe, expect, it } from "vitest";

import { consumeStatusImageRateLimit, consumeStatusRateLimit } from "@/lib/status-rate-limit";

describe("private status rate limiting", () => {
  it("allows 60 page reads per minute and rejects the next one", () => {
    const now = Date.parse("2026-07-31T00:00:00.000Z");

    for (let index = 0; index < 60; index += 1) {
      expect(consumeStatusRateLimit("reader", now)).toEqual({ allowed: true });
    }
    expect(consumeStatusRateLimit("reader", now)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(consumeStatusRateLimit("reader", now + 60_000)).toEqual({
      allowed: true,
    });
  });

  it("uses a tighter independent budget for PNG rendering", () => {
    const now = Date.parse("2026-07-31T00:00:00.000Z");

    for (let index = 0; index < 12; index += 1) {
      expect(consumeStatusImageRateLimit("reader", now)).toEqual({
        allowed: true,
      });
    }
    expect(consumeStatusImageRateLimit("reader", now)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(consumeStatusRateLimit("reader", now)).toEqual({ allowed: true });
  });
});
