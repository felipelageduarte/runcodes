import { defineConfig } from "vitest/config";

// Exercises the real stack: Postgres + S3 from the local-dev docker
// compose, started separately. Requires .env to point at them. Serial
// (fileParallelism: false) because every file shares one database.
export default defineConfig({
  test: {
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
