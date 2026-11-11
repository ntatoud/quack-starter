import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Flaky tests are fixed, not retried.
    retry: 0,
  },
});
