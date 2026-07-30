import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/api/**/*.test.ts",
    ],
    setupFiles: ["./tests/integration/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts", "src/services/**/*.ts"],
      exclude: ["src/lib/logger.ts"],
      thresholds: {
        statements: 75,
        branches: 60,
        functions: 85,
        lines: 75,
      },
    },
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
