import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { resetEnvForTests } from "@/lib/env";
import { getClientIp, hasValidMutationOrigin, requestFingerprints } from "@/lib/request-security";

function request(headers: Record<string, string>) {
  return new NextRequest("https://ask.example.com/api/questions", { headers });
}

describe("请求来源安全", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: "test",
      IP_HASH_SECRET: "test-ip-hash-secret-with-at-least-32-characters",
      TRUST_CLOUDFLARE_PROXY: "false",
      TRUST_PROXY: "false",
    });
    resetEnvForTests();
  });

  it("只接受 Origin 与 Host 完全同源的写请求", () => {
    expect(
      hasValidMutationOrigin(
        request({ origin: "https://ask.example.com", host: "ask.example.com" }),
      ),
    ).toBe(true);
    expect(
      hasValidMutationOrigin(request({ origin: "https://evil.example", host: "ask.example.com" })),
    ).toBe(false);
    expect(hasValidMutationOrigin(request({ host: "ask.example.com" }))).toBe(false);
  });

  it("默认不信任客户端伪造的代理头", () => {
    const nextRequest = request({
      "x-forwarded-for": "203.0.113.8",
      "cf-connecting-ip": "203.0.113.9",
    });
    expect(getClientIp(nextRequest)).toBe("unknown");
  });

  it("只在显式信任 Cloudflare 时读取 CF-Connecting-IP", () => {
    process.env.TRUST_CLOUDFLARE_PROXY = "true";
    resetEnvForTests();
    const nextRequest = request({ "cf-connecting-ip": "203.0.113.9" });
    expect(getClientIp(nextRequest)).toBe("203.0.113.9");
    expect(requestFingerprints(nextRequest).ipHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("拒绝带换行或异常长度的来源头", () => {
    process.env.TRUST_PROXY = "true";
    resetEnvForTests();
    expect(getClientIp(request({ "x-forwarded-for": "x".repeat(65) }))).toBe("unknown");
  });
});
