import { describe, expect, it } from "vitest";

import { hmacHash, safeEqual } from "@/lib/crypto";

describe("来源哈希与摘要比较", () => {
  it("使用密钥生成稳定且不包含原始 IP 的 SHA-256 HMAC", () => {
    const ip = "203.0.113.42";
    const first = hmacHash(ip, "a-secret");
    expect(first).toHaveLength(64);
    expect(first).not.toContain(ip);
    expect(first).toBe(hmacHash(ip, "a-secret"));
    expect(first).not.toBe(hmacHash(ip, "another-secret"));
  });

  it("恒定长度摘要比较能正确验证相等性", () => {
    expect(safeEqual("correct", "correct")).toBe(true);
    expect(safeEqual("wrong", "correct")).toBe(false);
  });
});
