import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  // .env lives at the repo root, next to .env.example.
  envDir: "../..",
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  test: {
    allowOnly: !process.env.CI,
    // Flaky tests are fixed, not retried.
    retry: 0,
    projects: [
      {
        extends: true,
        test: { name: "node", environment: "node", include: ["src/**/*.test.ts"] },
      },
      {
        // Components are tested in a real browser, with the theme: see packages/form/vite.config.ts.
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["src/testing/setup.ts"],
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
