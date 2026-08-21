import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    testTimeout: 15000,
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["routes/**", "services/**", "middleware/**", "utils/**"],
    },
  },
});
