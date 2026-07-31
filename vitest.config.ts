import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "src/lib/crypto.ts",
        "src/lib/rate-limit.ts",
        "src/lib/request-security.ts",
        "src/lib/spam.ts",
        "src/lib/time.ts",
        "src/lib/turnstile.ts",
        "src/lib/validation.ts",
        "src/services/answers.ts",
        "src/services/sessions.ts",
        "src/services/submission.ts",
      ],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
