import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ChildProcessSpawner } from "effect/process";
import type { ChildProcess } from "effect/process";

import { DockerNotRunning, PostgresDidNotStart, devDatabaseUrl } from "#/dev/dev-database.ts";

const commandLine = (command: ChildProcess.Command) =>
  command._tag === "StandardCommand" ? [command.command, ...command.args].join(" ") : "a pipe";

const spawnerAnswering = (exitCodeOf: (commandLine: string) => number) => {
  const ran: Array<string> = [];
  const layer = Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.ChildProcessSpawner.of({
      ...ChildProcessSpawner.make(() => Effect.die("spawned a process")),
      exitCode: (command) =>
        Effect.sync(() => {
          const line = commandLine(command);
          ran.push(line);
          return ChildProcessSpawner.ExitCode(exitCodeOf(line));
        }),
    }),
  );
  return { layer, ran };
};

describe("devDatabaseUrl", () => {
  it.effect("answers a DATABASE_URL set by hand as given, with no Docker", () => {
    const docker = spawnerAnswering(() => 0);
    return Effect.gen(function* () {
      const url = yield* devDatabaseUrl(
        { DATABASE_URL: "postgres://me:pw@db.example/mine" },
        { seed: true },
      );

      assert.strictEqual(url, "postgres://me:pw@db.example/mine");
      assert.deepStrictEqual(docker.ran, []);
    }).pipe(Effect.provide(docker.layer));
  });

  it.effect("fails with a message to start Docker when Docker does not run", () => {
    const docker = spawnerAnswering(() => 1);
    return Effect.gen(function* () {
      const error = yield* Effect.flip(devDatabaseUrl({}, { seed: true }));

      assert.instanceOf(error, DockerNotRunning);
      assert.match(error.message, /start Docker/);
    }).pipe(Effect.provide(docker.layer));
  });

  it.effect("fails with the exit code of docker compose when Docker runs", () => {
    const docker = spawnerAnswering((line) => (line.startsWith("docker compose") ? 17 : 0));
    return Effect.gen(function* () {
      const error = yield* Effect.flip(devDatabaseUrl({}, { seed: true }));

      assert.deepStrictEqual(error, new PostgresDidNotStart({ exitCode: 17 }));
    }).pipe(Effect.provide(docker.layer));
  });
});
