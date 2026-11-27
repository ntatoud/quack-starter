import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      test: {
        command: "vp test run",
        // A task sees only the variables it names. Which server runs the tests does not change their result.
        cache: { untrackedEnv: ["TEST_DATABASE_URL"] },
      },
    },
  },
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
