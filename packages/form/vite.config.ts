import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  // The tests render with the theme: sizes, focus rings, and `sr-only` come from it.
  plugins: [tailwindcss()],
  test: {
    include: ["src/**/*.test.tsx"],
    setupFiles: ["src/testing/setup.ts"],
    // Components are tested in a real browser: a simulated DOM has no focus rules, no keyboard,
    // no accessibility tree, and no stylesheet, which is where most of what they promise lives.
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
    // Flaky tests are fixed, not retried.
    retry: 0,
  },
});
