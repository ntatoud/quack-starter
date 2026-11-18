# 0001: Postgres through Effect SQL templates, no ORM or query builder

Accepted, 2026-11-18. Decided in [#92](https://github.com/ntatoud/quack-starter/issues/92) and [#93](https://github.com/ntatoud/quack-starter/issues/93).

## Context

The server stores its data in PostgreSQL. A newcomer expects Drizzle, Prisma, or Kysely. The server is written in Effect v4, whose errors, services, and schemas the rest of the code uses, and `effect/sql` with `@effect/sql-pg` (a native wire-protocol client) covers the client, the pool, transactions, migrations, and the decoding of rows by any Effect schema. Effect's Kysely and Drizzle integrations support Effect 3 only.

## Decision

- Queries are `sql` tagged templates of `@effect/sql-pg`, decoded by `SqlSchema` (`findAll`, `findOneOption`, `void`) with a row schema private to the adapter, which maps it to the contract's types.
- No `Model` / `SqlModel.makeRepository`: the repository ports are not CRUD by id.
- Every value is a bound parameter. `sql.unsafe`, which sends its text as is, is banned outside `database/migrations/` (lint rule `quack/no-sql-unsafe`).
- Columns are snake_case; the client maps them to camelCase (`transformQueryNames`, `transformResultNames`).
- A database failure is a defect in the adapter (a 500). A `UniqueViolation` on a constraint named in a migration maps to the domain's error.

## Consequences

- A typo in a column name inside the SQL text fails at runtime, on the first call, not at compile time. Accepted on purpose: tests against a real Postgres are what catch it.
- One hand-written statement per port method, so what runs is what is read.
- The SQL modules of Effect are marked unstable; the catalog pins their version.
