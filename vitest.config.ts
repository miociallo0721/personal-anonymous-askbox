import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts", "src/services/**/*.ts"],
      exclude: ["src/lib/logger.ts"],
    },
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
