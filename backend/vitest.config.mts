import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.{js,ts}"],
    // Skip repository integration tests by default (require database setup)
    // Run with: INTEGRATION_TESTS=true yarn test to include them
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      ".cache/**",
      "public/**",
      // Skip repository tests unless explicitly enabled
      ...(process.env.INTEGRATION_TESTS !== "true"
        ? ["**/repositories/__tests__/**"]
        : []),
    ],
    // Run repository tests sequentially to avoid database conflicts
    // Unit tests can still run in parallel
    fileParallelism: process.env.INTEGRATION_TESTS === "true" ? false : true,
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{js,ts}"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.{js,ts}", "src/admin/**"],
    },
  },
});
