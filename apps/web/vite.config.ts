import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // .env lives at the repo root, next to .env.example.
  envDir: "../..",
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    allowOnly: !process.env.CI,
    // Flaky tests are fixed, not retried.
    retry: 0,
  },
});
