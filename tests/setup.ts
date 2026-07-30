Object.assign(process.env, {
  NODE_ENV: "test",
  ADMIN_PASSWORD: "test-admin-password",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  IP_HASH_SECRET: "test-ip-hash-secret-with-at-least-32-characters",
  TURNSTILE_ENABLED: "false",
  TRUST_CLOUDFLARE_PROXY: "false",
  TRUST_PROXY: "false",
  TZ: "Asia/Shanghai",
});
