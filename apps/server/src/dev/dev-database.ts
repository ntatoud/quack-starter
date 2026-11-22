import * as Path from "node:path";
import { fileURLToPath } from "node:url";

import { PgClient } from "@effect/sql-pg";
import { Effect, Redacted, Schema, String } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { SqlClient } from "effect/sql/SqlClient";

import { migrationFileNames, migrationsDirectory } from "#/database/migration-files.ts";
import { appliedMigrations, migrationsTableExists } from "#/database/rollback.ts";
import { seedDatabase } from "#/database/seed.ts";
import { checkRecorded, databaseFor, Divergence, sharedDatabase } from "#/dev/database-choice.ts";

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

export class MigrationsDiverged extends Schema.TaggedError<
  MigrationsDiverged,
  { readonly brand: unique symbol }
>()("MigrationsDiverged", {
  database: Schema.String,
  divergences: Schema.Array(Divergence),
}) {
  override get message() {
    const clashes = this.divergences
      .map(
        ({ id, recorded, file }) =>
          `migration ${id} is recorded as ${recorded}, the branch has ${file}`,
      )
      .join("; ");

    const way =
      this.database === sharedDatabase
        ? "renumber the branch's migrations after those of the default branch, or set DEV_DATABASE=own"
        : `drop the database ${this.database}, which the launcher then creates again empty`;

    return `The database ${this.database} and this branch have diverged: ${clashes}. To start, ${way}.`;
  }
}

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const composeFile = Path.join(repoRoot, "compose.yaml");
const serverUrl = "postgres://quack:quack@127.0.0.1:54320";

const commandNotFound = ChildProcessSpawner.ExitCode(127);

// `portless compose` routes the inbox of Mailpit to https://mailpit.quack.localhost, on a free port. It has to
// start the containers every time: a plain `docker compose up` recreates them with the ports of compose.yaml.
const composeUp = (env: Readonly<Record<string, string | undefined>>) =>
  ChildProcess.make(
    env["PORTLESS"] === "0" ? "docker" : "portless",
    ["compose", "-f", composeFile, "up", "-d", "--wait"],
    { stdout: "inherit", stderr: "inherit" },
  );

const startPostgres = Effect.fn("startPostgres")(function* (
  env: Readonly<Record<string, string | undefined>>,
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const exitCode = yield* spawner
    .exitCode(composeUp(env))
    .pipe(Effect.orElseSucceed(() => commandNotFound));

  if (exitCode === 0) return;

  const dockerRuns = yield* spawner
    .exitCode(ChildProcess.make("docker", ["info"], { stdout: "ignore", stderr: "ignore" }))
    .pipe(
      Effect.map((code) => code === 0),
      Effect.orElseSucceed(() => false),
    );

  return yield* dockerRuns ? new PostgresDidNotStart({ exitCode }) : new DockerNotRunning();
});

const git = (args: ReadonlyArray<string>) =>
  Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) =>
    spawner.lines(ChildProcess.make("git", ["-C", repoRoot, ...args], { stderr: "ignore" })),
  ).pipe(
    Effect.map((lines) => lines.filter((line) => line !== "")),
    Effect.orElseSucceed((): ReadonlyArray<string> => []),
  );

const worktreeBranch = Effect.map(
  git(["symbolic-ref", "--short", "-q", "HEAD"]),
  (lines) => lines[0] ?? Path.basename(repoRoot),
);

const defaultBranchMigrations = Effect.gen(function* () {
  const known = yield* git(["rev-parse", "--verify", "-q", "origin/HEAD"]);

  if (known.length === 0) {
    yield* Effect.logWarning(
      "origin/HEAD is not known, so every migration counts as new: run git remote set-head origin --auto",
    );

    return [];
  }

  return yield* git([
    "ls-tree",
    "--name-only",
    `origin/HEAD:${Path.relative(repoRoot, migrationsDirectory)}`,
  ]);
});

const branchMigrations = Effect.promise(() => migrationFileNames(migrationsDirectory));

const chooseDatabase = Effect.fn("chooseDatabase")(function* (
  env: Readonly<Record<string, string | undefined>>,
) {
  const migrations = yield* branchMigrations;

  const name = databaseFor({
    devDatabase: env["DEV_DATABASE"],
    branch: yield* worktreeBranch,
    migrations,
    defaultMigrations: yield* defaultBranchMigrations,
  });

  yield* Effect.logInfo(
    name === sharedDatabase
      ? `Using the shared database ${name}`
      : `Using the database ${name} of this worktree: its branch adds migrations, or DEV_DATABASE=own`,
  );

  return { name, migrations };
});

const onServer = (database: string) =>
  Effect.provide(
    PgClient.layer({
      url: Redacted.make(`${serverUrl}/${database}`),
      transformResultNames: String.snakeToCamel,
    }),
  );

const checkMigrationsRecorded = Effect.fn("checkMigrationsRecorded")(
  function* (database: string, migrations: ReadonlyArray<string>) {
    const recorded = (yield* migrationsTableExists) ? yield* appliedMigrations : [];
    const { behind, diverged } = checkRecorded({ migrations, recorded });

    if (diverged.length > 0) {
      return yield* new MigrationsDiverged({ database, divergences: diverged });
    }

    if (behind.length > 0) {
      yield* Effect.logWarning(
        `The database ${database} records migrations this branch lacks: ${behind
          .map(({ id, name }) => `${id}_${name}`)
          .join(", ")}. Rebase the branch on the default branch to catch up.`,
      );
    }
  },
  (effect, database) => effect.pipe(onServer(database), Effect.scoped),
);

const recordsNoMigration = (database: string) =>
  Effect.gen(function* () {
    if (!(yield* migrationsTableExists)) return true;

    return (yield* appliedMigrations).length === 0;
  }).pipe(onServer(database), Effect.scoped);

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
  }).pipe(onServer("postgres"), Effect.scoped);

export const devDatabaseUrl = Effect.fn("devDatabaseUrl")(function* (
  env: Readonly<Record<string, string | undefined>>,
  { seed }: { readonly seed: boolean },
) {
  const given = env["DATABASE_URL"];

  if (given !== undefined && given !== "") return given;
  yield* startPostgres(env);
  const { name, migrations } = yield* chooseDatabase(env);
  yield* createDatabaseIfMissing(name);
  yield* checkMigrationsRecorded(name, migrations);
  const url = `${serverUrl}/${name}`;

  // Just created, or rolled back to 0: either way it holds no data to keep.
  if (seed && (yield* recordsNoMigration(name))) {
    yield* seedDatabase({ url: Redacted.make(url), maxConnections: 1 });
  }

  return url;
});
