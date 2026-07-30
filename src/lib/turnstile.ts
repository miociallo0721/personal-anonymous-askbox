import { z } from "zod";

import { getEnv } from "@/lib/env";

const turnstileResponse = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export async function verifyTurnstile(token: string, remoteIp?: string) {
  const env = getEnv();
  if (!env.TURNSTILE_ENABLED) return true;
  if (env.EXTERNAL_SERVICES_MOCK) return token === "test-turnstile-token";
  if (!token || !env.TURNSTILE_SECRET_KEY) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const parsed = turnstileResponse.safeParse(await response.json());
    if (!parsed.success || !parsed.data.success) return false;
    if (
      env.TURNSTILE_EXPECTED_HOSTNAME &&
      parsed.data.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
