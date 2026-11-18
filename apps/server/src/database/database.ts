import { NodeServices } from "@effect/platform-node";
import { PgClient, PgMigrator } from "@effect/sql-pg";
import { Effect, Layer, Redacted, Schema, String } from "effect";
import type { SqlError } from "effect/sql/SqlError";

import { DatabaseConfig } from "#/config.ts";
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

const Migrations = PgMigrator.layer({ loader: PgMigrator.fromFileSystem(migrationsDirectory) });

export const Database = Layer.unwrap(
  Effect.gen(function* () {
    const { url, maxConnections } = yield* DatabaseConfig;
    const PgClientLayer = PgClient.layer({
      url,
      maxConnections,
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    });
    return Migrations.pipe(
      Layer.provideMerge(PgClientLayer),
      Layer.catchTag("SqlError", (cause) =>
        Layer.effectDiscard(
          Effect.fail(
            refusesConnection(cause)
              ? new DatabaseUnreachable({ url: withoutPassword(Redacted.value(url)), cause })
              : cause,
          ),
        ),
      ),
    );
  }),
).pipe(Layer.provide(NodeServices.layer));
