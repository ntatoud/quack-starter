# What Effect 4.1.x provides to talk to PostgreSQL

Ticket: ntatoud/quack-starter#92 (child of #91). Researched against `effect` 4.1.4, `@effect/platform-node` 4.1.3 and `@effect/sql-pg` 4.1.4 (npm `latest`).

Sources, cited by short name below:

- `effect/sql`: `apps/server/node_modules/effect/src/sql/*.ts` (`SqlClient.ts`, `SqlError.ts`, `Migrator.ts`, `MigratorFileSystem.ts`, `SqlSchema.ts`, `SqlModel.ts`), and `.../effect/src/schema/Model.ts`.
- `sql-pg`: the published tarball of `@effect/sql-pg@4.1.4` (`npm pack`, read only, never run): `src/PgClient.ts`, `src/PgPool.ts`, `src/PgMigrator.ts`, `src/internal/config.ts`, `src/internal/sqlError.ts`, `src/PgConnection.ts`, `src/PgProtocol.ts`.
- Agent docs: `apps/server/node_modules/effect/ai-docs/src/40_sql/10_basics.ts` and `index.md`.

## Answer in short

- Package: `@effect/sql-pg` **4.1.4**, `peerDependencies: { effect: ^4.1.4 }`, no other runtime dependency. It does not wrap `pg` or `postgres`: it is a native wire-protocol client written in the package (`PgProtocol.ts`, `PgConnection.ts`). It matches the repo's `effect: 4.1.4` catalog entry exactly; add `"@effect/sql-pg": 4.1.4` to the catalog.
- Everything generic (`SqlClient`, `SqlSchema`, `SqlModel`, `Migrator`, `SqlError`, `Statement`) ships inside `effect` itself under `effect/sql` (`import { SqlClient, SqlSchema, SqlModel } from "effect/sql"`, `import { Model } from "effect/schema"`). `@effect/sql-pg` adds only the Postgres driver, its compiler, and `PgMigrator`.
- All of it is marked `@stability unstable` in the sources (module doc comments). The 4.x line is the stable version tag, but the SQL modules carry the unstable stability label.
- No gap found that forces Drizzle or Kysely for this starter. Gaps worth knowing are listed at the end (no `.sql` file loader, no down migrations, no checksum, no query builder).

## 1. Client and config

`PgClient.layer(config)`, `PgClient.layerConfig(Config.Wrap<config>)`, `PgClient.make(config)` (scoped, pooled), `PgClient.makeClient(config)` (single connection). The layers provide both `PgClient` and the generic `SqlClient` (`sql-pg` `PgClient.ts`, `layerFrom`).

Config (`PgPoolConfig`, `PgClient.ts`):

- `url?: Redacted.Redacted`. Parsed in `internal/config.ts` (`parseUrl`): protocols `postgres:` and `postgresql:` only; host, port, user, password (percent-decoded), database from the path; query params `host port user password dbname application_name options connect_timeout sslmode`. Unknown params are ignored, as libpq does. Explicit fields (`host`, `port`, `database`, `username`, `password`, `ssl`, ...) override the URL. Defaults: host `localhost`, port `5432`, user from `$USER`, connect timeout 5 s, `application_name` `@effect/sql-pg`.
- `password?: Redacted | Effect<Redacted>` (an Effect is evaluated per connection attempt, useful for rotating tokens).
- `ssl?: boolean | tls.ConnectionOptions`. URL `sslmode`: `disable` -> false, `require|verify-ca|verify-full` -> true, `prefer|allow` -> optional TLS (falls back to plaintext).
- Pool (`PgPool.ts` doc on `Config`): `maxConnections` (default 10), `minConnections` (default 0, lazy open), `idleTimeout` (default 60 s), `connectionTTL`, `acquireTimeout` (default unbounded), `connectTimeout`, `keepAlive`.
- Other: `multiplex` (pipeline queries from many fibers per connection, default off; transactions still reserve a connection), `prepare` (named prepared statements, default on; turn off behind PgBouncer transaction mode), `preparedStatementCacheSize` (100), `applicationName`, `startupParameters`, `onAcquire` hook, `transformResultNames` / `transformQueryNames` (e.g. `String.snakeToCamel` / `String.camelToSnake`, both exist in `effect/src/String.ts`), `transformJson`, `types` (custom type registry), `spanAttributes`.
- `PgClient.poolStats` gives idle/used/pending counts.

Wiring sketch for the repo's `ServerConfig`:

```ts
PgClient.layer({
  url: config.databaseUrl, // Redacted<string>, from Config.redacted("DATABASE_URL")
  maxConnections: 10,
  transformResultNames: String.snakeToCamel,
  transformQueryNames: String.camelToSnake,
});
```

`layerConfig` takes `Config.Wrap`, so `{ url: Config.redacted("DATABASE_URL") }` works directly. Misconfiguration (bad URL, no username) surfaces as `SqlError` with a `ConnectionError` reason when the layer builds (`configError` in `internal/config.ts`). Dates: `timestamp` and `timestamptz` decode to `Date` (`PgTypes.ts` header); `Date` parameters bind as `timestamptz`.

Peer environment: the pg `Migrator` needs `FileSystem`, `Path` and `ChildProcessSpawner` services (for the optional schema dump). `@effect/platform-node` 4.1.3 `NodeServices.layer` provides all three (`NodeServices.ts` merges `NodeChildProcessSpawner`, `NodeFileSystem`, `NodePath`).

## 2. Migrator

Sources: `effect/sql` `Migrator.ts`, `MigratorFileSystem.ts`; `sql-pg` `PgMigrator.ts`.

Authoring format: **TypeScript/JavaScript modules, not `.sql` files.** A migration is an `Effect<void, E, SqlClient>`; a file's default export is that Effect:

```ts
// 0001_create_users.ts
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE users (...)`;
});
```

Loaders (all return `Loader`, an Effect of `[id, name, load]` tuples sorted by id):

- `PgMigrator.fromFileSystem(dir)`: reads `dir` through `FileSystem`, matches `^(\d+)_([^.]+)\.(js|ts|mjs|mts)$`, dynamic `import()`s each file by file URL. Needs `FileSystem | Path`. Dynamic import of `.ts` needs a runtime that strips types (Node 26 in this repo does; verify under Vite/bundling if the server is ever bundled).
- `fromGlob` (a `import.meta.glob`-style record of lazy imports; bundler friendly), `fromBabelGlob`, `fromRecord({"0001_name": effect})` (inline effects, used by the ai-docs example).
- There is **no built-in loader for plain `.sql` files.** A custom loader is a few lines (read file, run `sql.unsafe(text)`), since `Loader` is just an Effect returning tuples.

Tracking table: `effect_sql_migrations` by default (`table` option). For `pg` it is created as `migration_id integer primary key, created_at timestamptz not null default now(), name text not null` (`Migrator.ts`, `createMigrationsTable`, `pg` branch). It records id and name only: no checksum, so an edited applied migration is not detected. Only ids greater than the latest recorded id run (`currentId <= latestMigrationId` is skipped), so an older-numbered migration added later is silently never run.

Run semantics (`Migrator.ts`, `run`):

- On pg the pending migrations run in **one transaction** (`sql.withTransaction(run)`), after `LOCK TABLE <table> IN ACCESS EXCLUSIVE MODE`. The ids are inserted up front; a concurrent runner hits a unique/constraint conflict and is reported as `MigrationError{kind:"Locked"}`, which the migrator swallows (logs at debug and returns `[]`), so two replicas starting at once is safe.
- All-or-nothing: any failing migration rolls back the whole batch (`MigrationError{kind:"Failed", cause}`). Other kinds: `Duplicates`, `ImportError`, `BadState`.
- Duplicate ids fail (`Duplicates`). Ids are integers parsed from the filename prefix (`0001_` and `1_` are both id 1).
- No down migrations, no rollback command.
- Optional `schemaDirectory` writes `_schema.sql` via `pg_dump` after a successful run (needs `pg_dump` on PATH; failure is only logged).

Running it:

- At startup: `PgMigrator.layer({ loader })` is `Layer.effectDiscard(run(options))`; provide it with `Layer.provideMerge(PgClient.layer(...))` so anything built on top sees a migrated database (pattern in `ai-docs/.../10_basics.ts`). Errors are layer errors (`MigrationError | SqlError`).
- From a script: `PgMigrator.run({ loader })` is a plain Effect needing `SqlClient | PgClient | ChildProcessSpawner | FileSystem | Path`; a script runs `run(...)` with the client layer and `NodeServices.layer`, via `NodeRuntime.runMain`. No separate CLI ships with the package.

## 3. Decoding rows: SqlSchema and Model

`SqlSchema` (`effect/sql/SqlSchema.ts`): `findAll`, `findNonEmpty` (fails `NoSuchElementError` when empty), `findOne` (fails `NoSuchElementError`), `findOneOption`, `void`. Each takes `{ Request, Result, execute }`: it encodes the request with `Request`, runs `execute(encodedRequest)` (a `sql\`...\``template), and decodes rows with`Result`via`Schema.decodeUnknownEffect`. Error channel: `E | SchemaError`(plus`NoSuchElementError`for the`one`/`nonEmpty`variants),`E`including`SqlError`. Any Effect Schema works as `Result`, so the contract's schemas can decode rows directly; with `transformResultNames: String.snakeToCamel`the column names line up with the schema fields. Types that Postgres does not return natively (e.g. branded ids are plain strings; dates arrive as`Date`) need the schema's encoded side to be what the driver returns (`Schema.DateFromSelf`or`Model.DateTimeInsertFromDate`style fields, not`Schema.Date` from strings).

`Model` (`effect/schema` `Model.ts`; `SqlModel.ts`): `Model.Class<T>("Name")({...})` defines one schema with variants `select` (the class itself), `insert`, `update`, `json`, `jsonCreate`, `jsonUpdate`. Field helpers: `Model.GeneratedByDb`, `Model.GeneratedByApp`, `Model.Sensitive`, `Model.Field({...})`, `Model.FieldOnly([...])`, `Model.FieldExcept([...])`, `Model.optionalOption`, `Model.UuidV4Insert`, `Model.UuidV7Insert`, `Model.DateTimeInsertFromDate`, `Model.DateTimeUpdateFromDate`, `Model.JsonFromString`. `SqlModel.makeRepository(Model, { tableName, spanPrefix, idColumn, softDeleteColumn? })` derives `insert`, `insertVoid`, `update`, `updateVoid`, `findById`, `delete` (insert uses `insert ... returning *`). Errors: `Schema.SchemaError | SqlError` (`findById` adds `NoSuchElementError`). `SqlModel.makeResolvers` builds batched `SqlResolver`s.

Fit with this repo: contracts forbid anything but `effect` imports, and `Model.Class` is in `effect`, so a Model could live in contracts, but the AGENTS rule that contracts hold data and validation while persistence is server-side suggests keeping DB row schemas (or `Model`) in the server's infrastructure layer and mapping to the contract's schemas, or using the contract schemas directly as `Result` where columns match.

## 4. Transactions

`sql.withTransaction(effect)` (`SqlClient.ts`, doc comment on `withTransaction`):

- Runs every statement of `effect` on one pinned (reserved) connection in `BEGIN ... COMMIT`; rolls back on failure or interruption.
- Nested `withTransaction` uses savepoints (`SAVEPOINT effect_sql_<n>`, released with `RELEASE SAVEPOINT` on pg), so it composes; the inner failing rolls back only to the savepoint.
- Isolation level: provide `SqlClient.BeginTransaction` with e.g. `"BEGIN ISOLATION LEVEL SERIALIZABLE"`.
- Retries: wrap the outermost `withTransaction` in `Effect.retry` on `SerializationError` / `DeadlockError` (documented example). Do not retry `ConnectionError` (a lost `COMMIT` may have committed).
- `sql.afterCommit(effect)` runs work only once the outermost transaction commits.
- A fiber forked inside a transaction and outliving it fails with `SqlError`. Statements issued with the ambient `SqlClient` inside the `withTransaction` effect use the transaction automatically (no tx handle to thread through), which fits ports implemented as Layers: a use case can wrap several repository calls in `sql.withTransaction` if the repositories share the same `SqlClient`.
- `PgClient` detail: if `COMMIT` returns `ROLLBACK` (aborted tx), it fails with an `UnknownError` `SqlError` (`PgClient.ts`, `commit`).

## 5. Unique-constraint violation

Surfacing (`sql-pg` `internal/sqlError.ts`, `classifySqlState`; `PgConnection.ts` `classifyFields`):

- The server's `ErrorResponse` fields (`PgProtocol.ts` `ErrorFields`: `code`, `message`, `detail`, `schema`, `table`, `column`, `constraint`, ...) are copied onto an `Error` used as `cause`, and the SQLSTATE `code` is classified into a typed reason.
- Code `23505` -> `SqlError { reason: UniqueViolation { constraint: string, cause, message?, operation? } }`. `constraint` is the violated constraint name (trimmed; `"unknown"` if the server sent none or an empty one). Other `23xxx` (not null 23502, foreign key 23503, check 23514) -> `ConstraintError` with no constraint field; the raw fields are still on `reason.cause` (`cause.constraint`, `cause.table`, `cause.column`, `cause.detail`, `cause.code`).
- Other classes: `08xxx` ConnectionError, `28xxx` AuthenticationError, `42501` AuthorizationError, other `42xxx` SqlSyntaxError, `40P01` DeadlockError, `40001` SerializationError, `55P03` LockTimeoutError, `57014` StatementTimeoutError, else UnknownError (`SqlError.ts` defines the union `SqlErrorReason`, each with `isRetryable`).

Handling it, tagged and without string matching:

```ts
sql`INSERT INTO users ...`.pipe(
  Effect.catchIf(
    (e) => e.reason._tag === "UniqueViolation" && e.reason.constraint === "users_email_key",
    () => new EmailAlreadyUsed(...)
  )
)
```

The constraint name is the Postgres name (the explicit `CONSTRAINT users_email_key UNIQUE (email)` or the default `<table>_<column>_key`), so naming constraints explicitly in migrations keeps this stable. Note the migrator itself relies on the same mapping (`isConstraintConflict`). Unlike some drivers, the SQLSTATE `code` is not a top-level field of `UniqueViolation`; it is implied by the tag.

## 6. Gaps and what they mean for Drizzle or Kysely

None blocks the use case; none of these needs an outside tool unless the team wants one of the first two:

1. No query builder. Queries are `sql` tagged templates with helpers (`sql.insert`, `sql.update`, `sql.in`, `sql.and`, `sql.or`, `sql.csv`, `sql(table)`, `.returning`, `sql.json`), parameterized safely, but not type-checked against a schema. Types come from `SqlSchema` decoding at runtime. Drizzle or Kysely would add compile-time column checking; they run on a different driver and error model, and they do not use the contract's Effect schemas.
2. No `.sql` migration loader and no migration generation (no `drizzle-kit` equivalent, no diffing of models to SQL). Migrations are hand-written, as TS Effects or via a small custom loader.
3. Migration tracking is minimal: id and name only, forward-only, no checksum, ids below the latest are skipped.
4. Everything is `@stability unstable`; APIs may shift in minor releases (pin with the catalog).
5. Self-written protocol client (not `pg`): less field time than `pg`/`postgres`. Notes in the source cover TLS, SCRAM auth (`PgAuth.ts`), pooling, multiplexing, `LISTEN/NOTIFY`; testing used `testcontainers` per its devDependencies.
6. `Model` variants are shaped for CRUD by id; filtered, sorted, paginated list queries (needed for the Users list) are written by hand with `SqlSchema.findAll` and fragments.
