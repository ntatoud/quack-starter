import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, String } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const [command, ...args] = process.argv.slice(2);

// `portless run` sets PORTLESS_URL to the API's own URL. The public origin is the web app's, which a worktree
// prefixes with its branch, so portless is asked for it. Without portless (`PORTLESS=0 pnpm dev`), PUBLIC_URL
// comes from .env.
Effect.gen(function* () {
  if (command === undefined) {
    return yield* Effect.die("Usage: with-public-url.ts <command> [...args]");
  }
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const env =
    process.env.PORTLESS_URL === undefined
      ? {}
      : {
          PUBLIC_URL: String.trim(
            yield* spawner.string(ChildProcess.make("portless", ["get", "quack"])),
          ),
        };
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make(command, args, {
      env,
      extendEnv: true,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
  process.exitCode = exitCode;
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
