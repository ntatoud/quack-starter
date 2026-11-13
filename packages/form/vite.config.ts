import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  // Sizes, focus rings, and `sr-only` come from the theme.
  plugins: [tailwindcss()],
  test: {
    include: ["src/**/*.test.tsx"],
    setupFiles: ["src/testing/setup.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
    retry: 0,
  },
});
