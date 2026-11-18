import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    allowOnly: !process.env.CI,
    retry: 0,
    sequence: { shuffle: true },
  },
});
