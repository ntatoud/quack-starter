import { NodeServices } from "@effect/platform-node";
import { PgClient, PgMigrator } from "@effect/sql-pg";
import { Effect, Layer, Redacted, Schema, String } from "effect";
import { SqlClient } from "effect/sql";
import { isSqlError, type SqlError } from "effect/sql/SqlError";

import { DatabaseConfig, type DatabaseSettings } from "#/config.ts";
import { migrationsDirectory } from "#/database/migration-files.ts";

export class DatabaseUnreachable extends Schema.TaggedError<
  DatabaseUnreachable,
  { readonly brand: unique symbol }
>()("DatabaseUnreachable", { url: Schema.String, cause: Schema.Defect() }) {
  override get message() {
    const reason = this.cause instanceof Error ? this.cause.message : "no reason given";

    return `The server cannot connect to Postgres at ${this.url}: ${reason}`;
  }
}

export const withoutPassword = (url: string): string => {
  const parsed = URL.parse(url);

  if (parsed === null || !["postgres:", "postgresql:"].includes(parsed.protocol)) {
    return "a DATABASE_URL that is not a postgres URL";
  }

  if (parsed.password !== "") parsed.password = "***";

  if (parsed.searchParams.has("password")) parsed.searchParams.set("password", "***");

  return parsed.href;
};

const refusesConnection = (error: SqlError) =>
  error.reason._tag === "ConnectionError" || error.reason._tag === "AuthenticationError";

const unreachable = (url: Redacted.Redacted, cause: SqlError) =>
  refusesConnection(cause)
    ? new DatabaseUnreachable({ url: withoutPassword(Redacted.value(url)), cause })
    : cause;

const connectionTo = ({ url, maxConnections }: DatabaseSettings) => ({
  url,
  client: PgClient.layer({
    url,
    maxConnections,
    transformQueryNames: String.camelToSnake,
    transformResultNames: String.snakeToCamel,
  }),
});

const connection = Effect.map(DatabaseConfig, connectionTo);

const Migrations = PgMigrator.layer({ loader: PgMigrator.fromFileSystem(migrationsDirectory) });

export const databaseAt = (config: DatabaseSettings) => {
  const { url, client } = connectionTo(config);

  return Migrations.pipe(
    Layer.provideMerge(client),
    // A failing Layer that provides the client's services, as `catchTag` keeps only what both provide.
    Layer.catchTag("SqlError", (cause) =>
      Layer.effectContext<
        PgClient.PgClient | SqlClient.SqlClient,
        DatabaseUnreachable | SqlError,
        never
      >(Effect.fail(unreachable(url, cause))),
    ),
    Layer.provide(NodeServices.layer),
  );
};

export const Database = Layer.unwrap(Effect.map(DatabaseConfig, databaseAt));

export const withDatabase = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(connection, ({ url, client }) =>
    effect.pipe(
      Effect.provide(client),
      Effect.mapError((error) => (isSqlError(error) ? unreachable(url, error) : error)),
    ),
  );
