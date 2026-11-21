import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  plugins: [tailwindcss()],
  test: {
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
    retry: 0,
    sequence: { shuffle: true },
  },
});
