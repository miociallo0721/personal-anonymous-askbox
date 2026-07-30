import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    include: ["tests/integration/**/*.test.ts", "tests/api/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
