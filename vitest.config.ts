import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/server/test/global-setup.ts"],
    environment: "node",
    // A shared real database can't have files truncating it at the same time.
    fileParallelism: !process.env.TEST_DATABASE_URL,
    // Each file starts its own in-memory Postgres from a migrated snapshot.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
