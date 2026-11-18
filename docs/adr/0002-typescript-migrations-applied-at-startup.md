# 0002: Migrations are TypeScript files applied at startup, with a required `down` and our own rollback on Effect's forward-only Migrator

Accepted, 2026-11-18. Decided in [#93](https://github.com/ntatoud/quack-starter/issues/93) and [#99](https://github.com/ntatoud/quack-starter/issues/99).

## Context

Effect's `Migrator` loads migrations as modules whose default export is an Effect, records their id and name in `effect_sql_migrations`, runs the pending ones in one transaction under a table lock (so instances starting at once are safe), and goes forward only: it has no down migration and silently skips an id at or below the latest one recorded.

## Decision

- Migrations live in `apps/server/src/database/migrations/`, one folder for every module, since their order is global. A migration is a TypeScript file of plain SQL in a `sql` template, named with a 4-digit id: `0001_create_users.ts`. Its `default` export is its up; a named `down` export is required.
- The server applies the pending migrations at startup, in every environment, before it serves anything (`PgMigrator.layer` under the client). There is no migrate command.
- A plain Node test checks that the ids run from 1 with no gap or duplicate and that every migration exports `down`, since the Migrator would skip a misnumbered one without a word.
- Reverting is ours to build on top of the Migrator, in a later change: a rollback command will run the latest migration's `down` and delete its row, in one transaction. A `down` that cannot honestly undo (data dropped) fails with a message saying why.
- A migration may be edited until it is merged; after that, only a new migration changes the schema.

## Consequences

- Nothing serves on a schema older than the code. Rolling back a production database also means deploying the old code, since startup migrates forward again.
- Postgres unreachable at startup stops the process with a non-zero exit, and whatever runs the server restarts it: no retry loop in the server.
- No `.sql` files and no schema dump: the migrations are the schema. Moving to another tool later means translating every migration, which grows costlier with each one.
