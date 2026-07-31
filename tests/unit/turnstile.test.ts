import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvForTests } from "@/lib/env";
import { verifyTurnstile } from "@/lib/turnstile";

describe("Turnstile verification", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      EXTERNAL_SERVICES_MODE: "live",
    });
    resetEnvForTests();
  });

  it("sends the token and remote IP to Cloudflare Siteverify", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(verifyTurnstile("token", "203.0.113.9", fetcher)).resolves.toBe(true);
    const body = fetcher.mock.calls[0]?.[1]?.body;
    expect(body?.toString()).toContain("response=token");
    expect(body?.toString()).toContain("remoteip=203.0.113.9");
  });

  it("fails closed on network and response errors", async () => {
    const networkFailure = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    const invalidResponse = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 200 }));
    await expect(verifyTurnstile("token", undefined, networkFailure)).resolves.toBe(false);
    await expect(verifyTurnstile("token", undefined, invalidResponse)).resolves.toBe(false);
  });
});
