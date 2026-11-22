import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

const envDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  // Vite gives .env to the browser bundle only, and only its VITE_ variables: the web server reads API_URL
  // from its process. A value already set in the process wins, as in production.
  const API_URL =
    process.env.PORTLESS_URL === undefined
      ? loadEnv(mode, envDir, "").API_URL
      : execFileSync("portless", ["get", "api.quack"], { encoding: "utf8" }).trim();

  if (API_URL !== undefined) process.env.API_URL = API_URL;

  return {
    envDir,
    plugins: [tailwindcss(), tanstackStart(), viteReact({ compiler: true })],
    // Without portless (`PORTLESS=0 pnpm dev`). Portless passes a port of its own on the command line, which wins.
    server: { port: 3000 },
    test: {
      allowOnly: !process.env.CI,
      retry: 0,
      sequence: { shuffle: true },
      projects: [
        {
          extends: true,
          test: { name: "node", environment: "node", include: ["src/**/*.test.ts"] },
        },
        {
          extends: true,
          test: {
            name: "browser",
            include: ["src/**/*.test.tsx"],
            setupFiles: ["src/testing/setup.ts"],
            // Only one page of a browser has the focus: the keystrokes of a file running in parallel go to another.
            fileParallelism: false,
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
