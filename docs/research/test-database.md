# Which database the Api tests run on, and how each test gets its own data

Research for [#258](https://github.com/ntatoud/quack-starter/issues/258), a child of [#257](https://github.com/ntatoud/quack-starter/issues/257). Measured on a MacBook (Darwin, Node), PGlite 0.5.17, `@effect/sql-pglite` 4.1.6, Postgres 18-alpine in Docker, 2026-11-27.

## Recommendation

Run the `Api` tests on **PGlite, one instance per test file, migrated once per file, each test owning its rows** (its own email, as today). `pnpm test` and CI's Test job then need no Postgres. Keep the real Postgres for the Database job (`db.gen.ts`), and optionally add one run of the same suite on it later.

Why: PGlite already runs in this repo (`packages/effect-kysely` tests, ADR 0007); `@effect/sql-pglite` gives the same `SqlClient` and the same `UniqueViolation` mapping; all of Quack's migrations apply unchanged; and `pnpm test` stays self-contained. A transaction rolled back per test is the wrong tool here (section 2). A database per test stays available on real Postgres if it is ever needed, and is cheap there.

## 1. Does each option work with the stack

Sources: the installed `@effect/sql-pglite` and `@effect/sql-pg` sources (`PgliteClient.ts`, `PgliteMigrator.ts`), `packages/effect-kysely/src/kysely.ts` and its test, `apps/server/src/database/database.ts`, the migrations, and a spike (deleted after, not committed).

| Need                                                             | PGlite (`PgliteClient`)                                                                                                                                                                                                                                                                                                                             | Real Postgres (`PgClient`)                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Kysely run by Effect SQL (`executor`)                            | Works. It needs only a `SqlClient`; `kysely.test.ts` already runs on PGlite with the camelCase name transforms the server sets.                                                                                                                                                                                                                     | Works (production path).                          |
| Migrations applied at startup                                    | Works. I ran all 7 real migrations through `PgliteMigrator.layer` (it re-exports the same `Migrator` as `PgMigrator`; `fromFileSystem` or `fromRecord`).                                                                                                                                                                                            | Works (`PgMigrator.layer`, as `databaseAt` does). |
| Enum (`user_status`), `uuid`, `timestamptz`, `gen_random_uuid()` | Work (migration 0001 ran; 100 inserts ran).                                                                                                                                                                                                                                                                                                         | Work.                                             |
| `text[]`                                                         | Works: migrations 0005 and 0006 ran; `select ARRAY['a','b']::text[]` returns `["a","b"]`.                                                                                                                                                                                                                                                           | Works.                                            |
| `citext`                                                         | Not in the default build: a bare `CREATE EXTENSION citext` failed in the spike. PGlite ships it as a contrib bundle (`@electric-sql/pglite/contrib/citext` exists in 0.5.17) loaded through the `extensions` option (not tried). **Quack uses no `citext` today** (emails are `text` with `users_email_key`), so this matters only if one is added. | Works (official image has contrib).               |
| `UniqueViolation` mapped by constraint name                      | Works. A duplicate insert failed with `reason._tag === "UniqueViolation"` and `reason.constraint === "users_email_key"`, which `user-repository-postgres.ts` matches on. `PgliteClient.ts` reads `constraint` off the cause.                                                                                                                        | Works (production path).                          |
| `sql.withTransaction`                                            | Works (`kysely.test.ts`: "joins the transaction of its fiber"). PGlite is one connection: no pool, so `maxConnections` means nothing and concurrent fibers are serialized.                                                                                                                                                                          | Pool; one connection per fiber's transaction.     |
| Concurrency semantics (two sessions, locks)                      | Not faithful: one session. The server uses no `FOR UPDATE`, advisory lock or `SERIALIZABLE` today (grep), so nothing in the current code needs it.                                                                                                                                                                                                  | Faithful.                                         |

Gaps to know: PGlite is a WASM build of a Postgres that may be a different major version than the dev and CI image (18); I did not check which. The Database job, not the Api tests, checks a feature added later against real Postgres. `@effect/sql-pglite` is a devDependency of `@quack/effect-kysely` only today; `apps/server` would add it (the catalog entry exists in `pnpm-workspace.yaml`).

## 2. Isolation under shuffled tests that share a `layer(...)`

Tests run shuffled (`vite.config.ts`, `sequence.shuffle`) and the tests of one `layer(...)` share its services (AGENTS.md).

- **Rows owned by each test, one database per test file.** The same rule as today's memory tests, and the one that matches `layer(...)` sharing: the Layer builds one migrated database and each test adds rows nobody else reads. Weakness: a test that lists everything (the Users list, `UserListQuery` paging) sees other tests' rows; today's memory runs behave the same. Mitigation: such a test asserts on its own rows, or sits in its own file.
- **Transaction rolled back per test.** Poor fit. Modules call `sql.withTransaction` themselves (map #257: writes that stand or fall together), which would nest as savepoints and hide a commit-time failure. On real Postgres the server's pool has several connections, so rows written in the test's transaction are invisible to the handler's connection unless the whole test is pinned to one. On PGlite (one connection) it is feasible but the test no longer exercises a real commit. Not recommended.
- **A database per test.** On real Postgres, `CREATE DATABASE ... TEMPLATE tpl` of a migrated template measured **26 to 68 ms** (45, 38, 32, 26, 68 over 5 clones), migrating the template once 184 ms, connecting to a clone and running the no-op migrator 9 ms (local Postgres 18 in Docker). On PGlite a database is a new instance, about 1.1 s (section 3): fine per file, too slow per test. PGlite has data-directory dump and load that might clone a migrated state faster than a reboot; not measured.

Prior art, cookout (`app/modules/testing/lib/server/postgres.ts` and `scripts/postgres-test-container.ts`, read with `gh api`): a vitest `globalSetup` starts one throwaway `postgres:18-alpine` container through the Docker CLI (`--tmpfs`, `fsync=off`, `synchronous_commit=off`, `full_page_writes=off`, `max_connections=1000`), with a watchdog process that removes it if the run dies, and hands the URL to tests with `provide("postgres", ...)` and `inject("postgres")`. It migrates a `cookout_template` database once, under an advisory lock so parallel workers do not race, then each scope gets `CREATE DATABASE cookout_test_<n> TEMPLATE cookout_template`, dropped on release (`Effect.acquireRelease`). If Docker is missing the setup provides a reason and tests fail with `StorageUnavailable` carrying it. So cookout chose real Postgres, a database per Layer scope, and requires Docker for its tests.

## 3. Cost

Baseline today: `vp test run` in `apps/server` takes **19 s** wall (37 files passed, 3 skipped). The 3 skipped are the `*-postgres.test.ts` files, gated on `TEST_DATABASE_URL`; CI runs no suite on Postgres (AGENTS.md of the server).

PGlite, real migrations, `PgliteMigrator.fromRecord`:

- Boot plus 7 migrations: 1445 ms cold, then 1108 and 1126 ms for the next instances in the same process: about **1.1 s per test file** that builds its own database, mostly WASM start. (`kysely.test.ts` already sets a 30 s timeout for the same reason.)
- Per test: 100 inserts took 10 ms, so an `HttpApiTest` request is dominated by its own work.
- Files run in parallel workers, so the cost is CPU more than wall time: about 7 s of CPU for 6 Api test files, spread over the workers.
- Memory per instance: not measured.

What each needs with no Postgres running:

- PGlite: nothing. `pnpm test` and the CI Test job (sharded, no service container today) work as they are.
- Real Postgres: Docker for a cookout-style container (start time not measured), or `TEST_DATABASE_URL` against the dev container (`compose.yaml`, port 54320). CI's Database job already declares a `postgres:18-alpine` service container (`ci.yml`), but the Test job runs in shards, each of which would need its own. Without Docker, `pnpm test` would fail or skip, the state of the three skipped files today.

## 4. Options compared

|                                  | PGlite per file                       | Docker Postgres, database per test (cookout)      | Shared Postgres via `TEST_DATABASE_URL` |
| -------------------------------- | ------------------------------------- | ------------------------------------------------- | --------------------------------------- |
| `pnpm test` with nothing running | Yes                                   | No (needs Docker)                                 | No                                      |
| CI changes                       | None                                  | Service container per shard, or Docker in the job | Same                                    |
| Faithful to production Postgres  | Mostly (WASM, one connection)         | Fully                                             | Fully                                   |
| Per-test isolation               | Own rows                              | Own database, 26 to 68 ms                         | Own rows                                |
| Added time                       | about 1.1 s CPU per file              | clone per test, plus container start              | about 0                                 |
| Extra dependency                 | `@effect/sql-pglite` in `apps/server` | Docker, a `globalSetup` script                    | A running Postgres                      |

## 5. What this leaves for the map

- Where the PGlite Layer lives: next to `server.ts` or in the surviving `testing` module (#257, "Not yet specified"). It is about ten lines: `PgliteClient.layer` with the server's camelCase transforms, `PgliteMigrator.layer({ loader: fromFileSystem(migrationsDirectory) })`, `NodeServices.layer` for the file system. The migrations are the schema: no test schema to keep in sync, and they apply as ADR 0002 says they do at startup.
- Optional later: run the same Api suite on real Postgres in the Database job (its service container exists) behind a `TEST_DATABASE_URL` switch, to catch what PGlite cannot (concurrency, version differences).
- Unmeasured: memory per PGlite instance, PGlite data-directory cloning, container start time, full-suite timing after the refactor, PGlite's Postgres major version.
