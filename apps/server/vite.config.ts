import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Migrates the template database every test clones: Postgres, from TEST_DATABASE_URL or Docker.
    globalSetup: ["src/modules/testing/lib/global-setup.ts"],
    allowOnly: !process.env.CI,
    retry: 0,
    sequence: { shuffle: true },
  },
});
