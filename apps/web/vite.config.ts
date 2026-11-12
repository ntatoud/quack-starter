import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

// .env lives at the repo root, next to .env.example.
const envDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  // Vite gives .env to the browser bundle only, and only its VITE_ variables.
  // The web server reads API_URL from its process (src/env/server.ts), so `vp dev` and `vp preview`
  // take it from .env here. A value already set in the process wins, as it does in production:
  // restart `pnpm dev` after changing it.
  const { API_URL } = loadEnv(mode, envDir, "");
  if (API_URL !== undefined) process.env.API_URL = API_URL;

  return {
    envDir,
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
  };
});
