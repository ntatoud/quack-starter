import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { Email } from "@quack/contracts/identity/user";
import { ConfigProvider, Effect, Layer, Option, Redacted, Schema } from "effect";
import { Cookies, HttpClientRequest, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import { SqlClient, SqlSchema } from "effect/sql";

import type { DatabaseSettings } from "#/config.ts";
import { databaseAt, withoutPassword } from "#/database/database.ts";
import { MIGRATIONS_TABLE } from "#/database/rollback.ts";
import { IdentityModule, IdentityPostgres, IdentitySeed } from "#/modules/identity/index.ts";
import { Mailer } from "#/modules/mail/index.ts";
import { seedTodos, TodosModule } from "#/modules/todos/index.ts";
import { TransactionPostgres } from "#/modules/transaction/index.ts";

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

// The Api the seed calls in process, as a browser would: it sends no mail, and no link it makes leaves the seed.
const SeedApi = TodosModule.pipe(
  Layer.provideMerge(IdentityModule),
  Layer.provide([
    TransactionPostgres,
    Layer.succeed(Mailer, Mailer.of({ send: () => Effect.void })),
  ]),
  Layer.provideMerge(HttpServer.layerServices),
  Layer.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ PUBLIC_URL: "http://localhost" })),
  ),
);

// As `signedIn` of the testing module, which the seed, run outside tests, cannot import.
const withCookie = (cookie: string | undefined) =>
  HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
    next(cookie === undefined ? request : HttpClientRequest.setHeader(request, "cookie", cookie)),
  );

const signedInAs = Effect.fn("signedInAs")(function* (email: string) {
  const visitor = yield* HttpApiTest.groups(Api, ["identity"]).pipe(
    Effect.provide(withCookie(undefined)),
  );

  const [, response] = yield* visitor.identity.signIn({
    payload: { email: Email.make(email), password: Redacted.make(devPassword) },
    responseMode: "decoded-and-response",
  });

  const session = Cookies.getValue(response.cookies, "session");

  return yield* HttpApiTest.groups(Api, ["identity", "todos"]).pipe(
    Effect.provide(
      withCookie(Option.getOrUndefined(Option.map(session, (token) => `session=${token}`))),
    ),
  );
});

// The Todos go through the Api, signed in as each dev account: the seed makes no state the Api cannot.
const seedTodosOfDevAccounts = Effect.forEach(
  Object.values(devAccounts),
  (email) => Effect.flatMap(signedInAs(email), ({ todos }) => seedTodos(todos)),
  { discard: true },
).pipe(Effect.provide(SeedApi));

const reset = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(
    truncateTables.pipe(
      Effect.andThen(Layer.build(IdentitySeed)),
      Effect.andThen(seedTodosOfDevAccounts),
      Effect.scoped,
    ),
  );
});

export const seedDatabase = Effect.fn("seedDatabase")(function* (config: DatabaseSettings) {
  const url = Redacted.value(config.url);

  if (!isLocalDatabaseUrl(url)) {
    return yield* new NotLocalDatabase({ url: withoutPassword(url) });
  }

  yield* reset.pipe(Effect.provide(IdentityPostgres.pipe(Layer.provideMerge(databaseAt(config)))));
});
