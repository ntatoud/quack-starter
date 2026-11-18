import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { devDatabaseUrl } from "#/dev/dev-database.ts";

const [command, ...args] = process.argv.slice(2);

Effect.gen(function* () {
  if (command === undefined) {
    return yield* Effect.die("Usage: with-dev-database.ts <command> [...args]");
  }
  const url = yield* devDatabaseUrl(process.env);
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
