import { z } from "zod";

const booleanString = (fallback: boolean) =>
  z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? fallback : value === "true"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().startsWith("file:").default("file:./data/askbox.db"),
  ADMIN_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  IP_HASH_SECRET: z.string().min(32),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_CHAT_ID: z.string().default(""),
  ADMIN_PUBLIC_URL: z.string().default(""),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().default(""),
  TURNSTILE_SECRET_KEY: z.string().default(""),
  TURNSTILE_EXPECTED_HOSTNAME: z.string().default(""),
  TURNSTILE_ENABLED: booleanString(true),
  TRUST_CLOUDFLARE_PROXY: booleanString(false),
  TRUST_PROXY: booleanString(false),
  EXTERNAL_SERVICES_MOCK: booleanString(false),
  LOGIN_ATTEMPT_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  TZ: z.string().default("Asia/Shanghai"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join("、");
    throw new Error(`环境变量配置错误：${fields}`);
  }
  cachedEnv = parsed.data;
  return parsed.data;
}

export function validateRuntimeEnv() {
  const env = getEnv();
  if (env.NODE_ENV === "production" && env.ADMIN_PASSWORD.length < 12) {
    throw new Error("生产环境 ADMIN_PASSWORD 至少需要 12 个字符");
  }
  if (env.NODE_ENV === "production" && env.EXTERNAL_SERVICES_MOCK) {
    throw new Error("生产环境禁止启用外部服务 Mock");
  }
  if (env.TRUST_CLOUDFLARE_PROXY && env.TRUST_PROXY) {
    throw new Error("TRUST_CLOUDFLARE_PROXY 与 TRUST_PROXY 不能同时启用");
  }
  if (env.TURNSTILE_ENABLED) {
    if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) {
      throw new Error("Turnstile 已启用，但 Site Key 或 Secret Key 缺失");
    }
  } else if (env.NODE_ENV === "production") {
    console.warn("警告：生产环境已显式关闭 Turnstile");
  }
  const telegramValues = [env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, env.ADMIN_PUBLIC_URL];
  if (env.NODE_ENV === "production" && !telegramValues.every(Boolean)) {
    throw new Error("生产环境必须完整配置 Telegram Bot Token、Chat ID 和后台公开 URL");
  }
  if (telegramValues.some(Boolean) && !telegramValues.every(Boolean)) {
    throw new Error("Telegram 配置必须同时提供 Bot Token、Chat ID 和后台公开 URL");
  }
  if (env.ADMIN_PUBLIC_URL) z.url().parse(env.ADMIN_PUBLIC_URL);
  if (env.NODE_ENV === "production" && !env.TRUST_CLOUDFLARE_PROXY && !env.TRUST_PROXY) {
    console.warn("警告：生产环境未配置可信代理，所有访客将共享 unknown 来源指纹");
  }
  return env;
}

export function resetEnvForTests() {
  cachedEnv = undefined;
}
