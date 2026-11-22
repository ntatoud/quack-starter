import { Effect, String } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { runWithEnv } from "#/dev/run-with-env.ts";

// `portless run` sets PORTLESS_URL to the API's own URL. The public origin is the web app's, which a worktree
// prefixes with its branch, so portless is asked for it. Without portless (`PORTLESS=0 pnpm dev`), PUBLIC_URL
// comes from .env.
runWithEnv(
  "with-public-url.ts <command> [...args]",
  process.argv.slice(2),
  Effect.gen(function* () {
    if (process.env.PORTLESS_URL === undefined) return {};
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const url = yield* spawner.string(ChildProcess.make("portless", ["get", "quack"]));

    return { PUBLIC_URL: String.trim(url) };
  }),
);
