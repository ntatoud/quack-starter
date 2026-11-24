import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import {
  type Compilable,
  DummyDriver,
  Kysely,
  type KyselyPlugin,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";

// Kysely's own `execute` would run nothing and answer no rows: refuse it, so a query run without the executor fails at once.
class CompileOnlyDriver extends DummyDriver {
  override acquireConnection(): never {
    throw new Error(
      "This Kysely only builds queries: run one with the executor of @quack/effect-kysely/kysely.",
    );
  }
}

/**
 * A Kysely for Postgres that builds and compiles queries and never connects. `executor` runs them on the `SqlClient`,
 * so a query joins the transaction of its fiber, fails with a `SqlError`, and is traced as any `sql` template.
 */
export const postgres = <Database>(
  options: { readonly plugins?: ReadonlyArray<KyselyPlugin> } = {},
) =>
  new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new CompileOnlyDriver(),
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [...(options.plugins ?? [])],
  });

export type Execute = <Row>(query: Compilable<Row>) => Effect.Effect<ReadonlyArray<Row>, SqlError>;

/**
 * The `execute` of the `SqlClient` in context, read once where a Layer is built, as an adapter reads `sql`: a query
 * still runs in the transaction of the fiber that runs it.
 */
export const executor: Effect.Effect<Execute, never, SqlClient.SqlClient> = Effect.map(
  SqlClient.SqlClient,
  (sql) =>
    <Row>(query: Compilable<Row>) => {
      // The compiled text holds placeholders only: Kysely binds every value as a parameter.
      const { sql: text, parameters } = query.compile();

      return sql.unsafe<Row & object>(text, parameters);
    },
);
