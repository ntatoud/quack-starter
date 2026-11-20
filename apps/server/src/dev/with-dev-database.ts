import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { devDatabaseUrl } from "#/dev/dev-database.ts";

const argv = process.argv.slice(2);
const seed = argv[0] === "--seed";
const [command, ...args] = seed ? argv.slice(1) : argv;

Effect.gen(function* () {
  if (command === undefined) {
    return yield* Effect.die("Usage: with-dev-database.ts [--seed] <command> [...args]");
  }
  const url = yield* devDatabaseUrl(process.env, { seed });
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make(command, args, {
      env: { DATABASE_URL: url },
      extendEnv: true,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
  process.exitCode = exitCode;
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
