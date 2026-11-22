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

const composeFails = (line: string) => (line.includes("compose") ? 17 : 0);

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

  it.effect("fails with the exit code of compose up when Docker runs", () => {
    const docker = spawnerAnswering(composeFails);

    return Effect.gen(function* () {
      const error = yield* Effect.flip(devDatabaseUrl({}, { seed: true }));

      assert.deepStrictEqual(error, new PostgresDidNotStart({ exitCode: 17 }));
    }).pipe(Effect.provide(docker.layer));
  });

  it.effect("starts the containers through portless, or Docker alone with PORTLESS=0", () => {
    const portless = spawnerAnswering(composeFails);
    const docker = spawnerAnswering(composeFails);

    return Effect.gen(function* () {
      yield* Effect.flip(devDatabaseUrl({}, { seed: true })).pipe(Effect.provide(portless.layer));
      yield* Effect.flip(devDatabaseUrl({ PORTLESS: "0" }, { seed: true })).pipe(
        Effect.provide(docker.layer),
      );

      assert.match(portless.ran[0] ?? "", /^portless compose -f .+compose\.yaml up -d --wait$/);
      assert.match(docker.ran[0] ?? "", /^docker compose -f .+compose\.yaml up -d --wait$/);
    });
  });
});
