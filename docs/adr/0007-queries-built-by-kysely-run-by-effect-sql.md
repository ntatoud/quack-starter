# 0007: Queries and migrations built by Kysely, run by Effect SQL, tables typed by kysely-codegen

Accepted, 2026-11-24. Supersedes [0001](0001-postgres-through-effect-sql-templates.md); amends [0002](0002-typescript-migrations-applied-at-startup.md) on how a migration is written.

## Context

ADR 0001 wrote every query as a `sql` template of `@effect/sql-pg` and accepted that a typo in a column name fails at runtime, on the first call, caught by tests against a real Postgres. Effect's own Kysely integration, `@effect/sql-kysely`, stops at Effect 3. kysely-ctl, the CLI of Kysely's migrations, runs them on a Kysely of its own with a real driver, outside Effect, and generates no types.

## Decision

- `@quack/effect-kysely` is the adapter, one small module: `postgres<Tables>()` is a Kysely that builds and compiles queries and never connects, and `executor` runs a compiled query on the `SqlClient` in context. So a query joins the transaction of its fiber, fails with the client's `SqlError` (`UniqueViolation` and its constraint included), and is traced as a `sql` template. Its tests run on PGlite.
- Kysely's own `execute` throws: the driver is compile-only, so a query that skips `executor` fails at once instead of answering no rows.
- A migration builds its statements with `db.schema` (`createTable`, `createType`, `createIndex`) and runs them through `executor`, still loaded and recorded by Effect's Migrator, still applied at startup, still reverted by `pnpm db:rollback` (ADR 0002). A constraint keeps its explicit name.
- The tables are typed by kysely-codegen, from a database the migrations built: `pnpm db:gen` migrates the dev database and writes `apps/server/src/database/db.gen.ts`, columns and tables in camelCase (`CamelCasePlugin`). Nobody edits that file. `db.ts` makes its array columns readonly, as the contracts' arrays are.
- An adapter builds each query with `db` and decodes its rows with `SqlSchema` and a row schema private to it, as before: Kysely types the columns, the schema validates the values.
- Every value is a bound parameter. `sql.unsafe` stays banned outside the migrations and `executor`; Kysely's `sql.raw` and `sql.lit` are banned everywhere (lint rule `quack/no-sql-unsafe`).
- CI's Database job runs a Postgres: it fails when `db.gen.ts` is not what kysely-codegen generates from the migrations (`pnpm db:gen --verify`).
- The seed, the rollback, and the dev database keep `sql` templates: they read the Postgres catalog and the Migrator's table, which `db.gen.ts` leaves out.

## Consequences

- A wrong table or column, or a value of the wrong type, fails `pnpm typecheck`; a migration that `db.gen.ts` does not follow fails CI.
- A migration edited in place reaches `db.gen.ts` only once the dev database runs it again: `pnpm db:rollback`, restart, then `pnpm db:gen`.
- What runs is no longer the text in the file; `query.compile().sql` shows it.
- kysely-codegen imports the TypeScript of the workspace, version 7, which lacks the JS API its type overrides parse with: no override in `.kysely-codegenrc.json`, the readonly arrays come from a type in `db.ts` instead.
- Kysely and kysely-codegen are pinned, as the SQL modules of Effect are.
