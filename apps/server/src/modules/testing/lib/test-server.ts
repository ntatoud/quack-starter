import { PgClient } from "@effect/sql-pg";
import { Effect, Redacted, Schema } from "effect";
import { SqlClient } from "effect/sql";

/** What the global setup hands the tests: the Postgres server, and the migrated database each test clones. */
export const TestServer = Schema.Struct({ url: Schema.String, template: Schema.String });

export type TestServer = typeof TestServer.Type;

export const testServerKey = "testServer";

export const databaseUrl = (serverUrl: string, database: string) => {
  const url = new URL(serverUrl);
  url.pathname = `/${database}`;

  return url.href;
};

/** Runs statements on the server's `postgres` database, as `CREATE DATABASE` cannot run in the one it creates. */
export const onServer = <A, E>(
  serverUrl: string,
  statement: (sql: SqlClient.SqlClient) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    return yield* statement(yield* SqlClient.SqlClient);
  }).pipe(
    Effect.provide(
      PgClient.layer({
        url: Redacted.make(databaseUrl(serverUrl, "postgres")),
        maxConnections: 1,
        connectTimeout: "2 seconds",
      }),
    ),
  );
