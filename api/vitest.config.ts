import { defineConfig } from "vitest/config";

// Unit tests only — fast, no external dependencies. Integration tests
// (hit a real Postgres/S3) live in vitest.integration.config.ts instead.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
  },
});
