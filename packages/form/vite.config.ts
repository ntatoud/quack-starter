import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  test: {
    // Flaky tests are fixed, not retried.
    retry: 0,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          // A test that renders a form asks for a DOM itself: `// @vitest-environment happy-dom`.
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.tsx"],
        },
      },
      {
        // What a simulated DOM cannot show: the focus, the keyboard, the accessibility tree, and the theme's sizes.
        extends: true,
        plugins: [tailwindcss()],
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.tsx"],
          setupFiles: ["src/testing/browser-setup.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
