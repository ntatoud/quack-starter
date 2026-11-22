import { Effect, Layer, Redacted, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

import type { DatabaseSettings } from "#/config.ts";
import { databaseAt, withoutPassword } from "#/database/database.ts";
import { MIGRATIONS_TABLE } from "#/database/rollback.ts";
import { devAccountIds, IdentityPostgres, IdentitySeed } from "#/modules/identity/index.ts";
import { TodosPostgres, TodosSeed } from "#/modules/todos/index.ts";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export class NotLocalDatabase extends Schema.TaggedError<
  NotLocalDatabase,
  { readonly brand: unique symbol }
>()("NotLocalDatabase", { url: Schema.String }) {
  override get message() {
    return `pnpm db:seed resets the database, so it runs on localhost or 127.0.0.1 only, not on ${this.url}.`;
  }
}

export const isLocalDatabaseUrl = (url: string): boolean => {
  const parsed = URL.parse(url);
  return (
    parsed !== null &&
    ["postgres:", "postgresql:"].includes(parsed.protocol) &&
    LOCAL_HOSTS.has(parsed.hostname) &&
    // libpq lets a host parameter override the host of the URL.
    !parsed.searchParams.has("host") &&
    !parsed.searchParams.has("hostaddr")
  );
};

const truncateTables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const tables = yield* SqlSchema.findAll({
    Request: Schema.Void,
    Result: Schema.Struct({ tablename: Schema.String }),
    execute: () =>
      sql`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> ${MIGRATIONS_TABLE}`,
  })(undefined);
  if (tables.length === 0) return;
  yield* sql`TRUNCATE ${sql.csv(tables.map(({ tablename }) => sql`${sql(tablename)}`))} RESTART IDENTITY CASCADE`;
});

const reset = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(
    truncateTables.pipe(
      Effect.andThen(Layer.build(IdentitySeed)),
      Effect.andThen(Layer.build(TodosSeed(devAccountIds()))),
      Effect.scoped,
    ),
  );
});

export const seedDatabase = Effect.fn("seedDatabase")(function* (config: DatabaseSettings) {
  const url = Redacted.value(config.url);
  if (!isLocalDatabaseUrl(url)) {
    return yield* new NotLocalDatabase({ url: withoutPassword(url) });
  }
  yield* reset.pipe(
    Effect.provide(
      Layer.mergeAll(IdentityPostgres, TodosPostgres).pipe(Layer.provideMerge(databaseAt(config))),
    ),
  );
});
