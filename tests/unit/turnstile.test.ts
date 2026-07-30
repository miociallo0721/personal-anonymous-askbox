import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvForTests } from "@/lib/env";
import { verifyTurnstile } from "@/lib/turnstile";

describe("Turnstile 服务端验证", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: "test",
      ADMIN_PASSWORD: "test-admin-password",
      SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
      IP_HASH_SECRET: "test-ip-hash-secret-with-at-least-32-characters",
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-secret",
      TURNSTILE_EXPECTED_HOSTNAME: "ask.example.com",
      EXTERNAL_SERVICES_MOCK: "false",
    });
    resetEnvForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("接受成功且 hostname 匹配的响应", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, hostname: "ask.example.com" }), {
          status: 200,
        }),
      ),
    );
    await expect(verifyTurnstile("valid-token", "203.0.113.1")).resolves.toBe(true);
  });

  it("拒绝 hostname 不匹配、异常响应和网络失败", async () => {
    const mockedFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, hostname: "evil.example" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", mockedFetch);

    await expect(verifyTurnstile("token")).resolves.toBe(false);
    await expect(verifyTurnstile("token")).resolves.toBe(false);
    await expect(verifyTurnstile("token")).resolves.toBe(false);
  });

  it("测试 Mock 只接受固定 token", async () => {
    process.env.EXTERNAL_SERVICES_MOCK = "true";
    resetEnvForTests();
    await expect(verifyTurnstile("test-turnstile-token")).resolves.toBe(true);
    await expect(verifyTurnstile("wrong-token")).resolves.toBe(false);
  });
});
