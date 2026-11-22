import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/**
 * Runs the command `argv` names with `env` added to the process's own, on its terminal, and exits with its
 * exit code: the launchers of `package.json` chain such scripts, each adding the variables it derives.
 */
export const runWithEnv = <E>(
  usage: string,
  argv: ReadonlyArray<string>,
  env: Effect.Effect<Record<string, string>, E, NodeServices.NodeServices>,
) =>
  Effect.gen(function* () {
    const [command, ...args] = argv;
    if (command === undefined) return yield* Effect.die(`Usage: ${usage}`);
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    process.exitCode = yield* spawner.exitCode(
      ChildProcess.make(command, args, {
        env: yield* env,
        extendEnv: true,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }),
    );
  }).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
