import { fileURLToPath } from "node:url";

import { PgClient } from "@effect/sql-pg";
import { Effect, Redacted, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { SqlClient } from "effect/sql/SqlClient";

export class DockerNotRunning extends Schema.TaggedError<
  DockerNotRunning,
  { readonly brand: unique symbol }
>()("DockerNotRunning", {}) {
  override get message() {
    return "Docker does not run: start Docker (Docker Desktop or OrbStack), then run pnpm dev again.";
  }
}

export class PostgresDidNotStart extends Schema.TaggedError<
  PostgresDidNotStart,
  { readonly brand: unique symbol }
>()("PostgresDidNotStart", { exitCode: Schema.Int }) {
  override get message() {
    return `docker compose could not start Postgres (exit code ${this.exitCode}): see its output above.`;
  }
}

const composeFile = fileURLToPath(new URL("../../../../compose.yaml", import.meta.url));

const sharedDatabase = "quack";
const serverUrl = "postgres://quack:quack@127.0.0.1:54320";

const commandNotFound = ChildProcessSpawner.ExitCode(127);

const startPostgres = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const composeUp = yield* spawner
    .exitCode(
      ChildProcess.make("docker", ["compose", "-f", composeFile, "up", "-d", "--wait"], {
        stdout: "inherit",
        stderr: "inherit",
      }),
    )
    .pipe(Effect.orElseSucceed(() => commandNotFound));
  if (composeUp === 0) return;
  const dockerRuns = yield* spawner
    .exitCode(ChildProcess.make("docker", ["info"], { stdout: "ignore", stderr: "ignore" }))
    .pipe(
      Effect.map((exitCode) => exitCode === 0),
      Effect.orElseSucceed(() => false),
    );
  return yield* dockerRuns
    ? new PostgresDidNotStart({ exitCode: composeUp })
    : new DockerNotRunning();
});

const createDatabaseIfMissing = (name: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    const exists = sql`SELECT 1 FROM pg_database WHERE datname = ${name}`.pipe(
      Effect.map((rows) => rows.length > 0),
    );
    if (yield* exists) return;
    yield* Effect.logInfo(`Creating the database ${name}`);
    // Another worktree may create it at the same moment: then it exists, and that is enough.
    yield* sql`CREATE DATABASE ${sql(name)}`.pipe(
      Effect.catch((error) =>
        Effect.flatMap(exists, (created) => (created ? Effect.void : Effect.fail(error))),
      ),
    );
  }).pipe(
    Effect.provide(PgClient.layer({ url: Redacted.make(`${serverUrl}/postgres`) })),
    Effect.scoped,
  );

export const devDatabaseUrl = Effect.fn("devDatabaseUrl")(function* (
  env: Readonly<Record<string, string | undefined>>,
) {
  const given = env["DATABASE_URL"];
  if (given !== undefined && given !== "") return given;
  yield* startPostgres;
  yield* createDatabaseIfMissing(sharedDatabase);
  return `${serverUrl}/${sharedDatabase}`;
});
