import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // A test that renders a form asks for a DOM itself: `// @vitest-environment happy-dom`.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Flaky tests are fixed, not retried.
    retry: 0,
  },
});
