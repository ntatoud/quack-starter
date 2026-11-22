import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  // Sizes, focus rings, and `sr-only` come from the theme. The tests run the components as the web app compiles them.
  plugins: [tailwindcss(), viteReact({ compiler: true })],
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
