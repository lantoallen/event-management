import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // A shared real database can't have files truncating it at the same time.
    fileParallelism: !process.env.TEST_DATABASE_URL,
    // Each file starts its own in-memory Postgres, which takes a moment.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
