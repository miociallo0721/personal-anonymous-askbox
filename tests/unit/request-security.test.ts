import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { getClientIp, hasValidMutationOrigin, requestFingerprints } from "@/lib/request-security";
import { resetEnvForTests } from "@/lib/env";

function request(headers: Record<string, string>) {
  return new NextRequest("https://ask.example.com/api/questions", { headers });
}

describe("request security", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: "test",
      TRUST_CLOUDFLARE_PROXY: "false",
      TRUST_PROXY: "false",
    });
    resetEnvForTests();
  });

  it("does not trust client supplied forwarding headers by default", () => {
    const value = request({
      "cf-connecting-ip": "203.0.113.8",
      "x-forwarded-for": "198.51.100.8",
    });
    expect(getClientIp(value)).toBe("unknown");
  });

  it("uses Cloudflare's address only when that trust boundary is explicit", () => {
    process.env.TRUST_CLOUDFLARE_PROXY = "true";
    resetEnvForTests();
    expect(getClientIp(request({ "cf-connecting-ip": "203.0.113.8" }))).toBe("203.0.113.8");
  });

  it("hashes IP and user agent without returning the raw values as fingerprints", () => {
    process.env.TRUST_CLOUDFLARE_PROXY = "true";
    resetEnvForTests();
    const value = request({
      "cf-connecting-ip": "203.0.113.8",
      "user-agent": "Askbox test browser",
    });
    const fingerprints = requestFingerprints(value);
    expect(fingerprints.ipHash).toHaveLength(64);
    expect(fingerprints.userAgentHash).toHaveLength(64);
    expect(fingerprints.ipHash).not.toContain("203.0.113.8");
  });

  it("accepts only a syntactically valid matching mutation origin", () => {
    expect(
      hasValidMutationOrigin(
        request({ origin: "https://ask.example.com", host: "ask.example.com" }),
      ),
    ).toBe(true);
    expect(
      hasValidMutationOrigin(
        request({ origin: "https://attacker.example", host: "ask.example.com" }),
      ),
    ).toBe(false);
    expect(hasValidMutationOrigin(request({ origin: "not a url", host: "ask.example.com" }))).toBe(
      false,
    );
  });
});
