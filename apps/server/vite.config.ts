import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    allowOnly: !process.env.CI,
    retry: 0,
    sequence: { shuffle: true },
    // The tests of identity start Postgres in the process (PGlite), a second or two each, for Yielded Auth, which
    // has no memory adapter for a sign-up: the defaults of 5 and 10 seconds fail them when every file runs at once.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
