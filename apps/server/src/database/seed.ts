import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { CountryCode, Profile } from "@quack/contracts/identity/profile";
import { Email, Role, TimeZone } from "@quack/contracts/identity/user";
import { ConfigProvider, Effect, Layer, Option, Redacted, Schema } from "effect";
import { Cookies, HttpClientRequest, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import { SqlClient, SqlSchema } from "effect/sql";

import type { DatabaseSettings } from "#/config.ts";
import { databaseAt, withoutPassword } from "#/database/database.ts";
import { MIGRATIONS_TABLE } from "#/database/rollback.ts";
import { IdentityModule, IdentityPostgres } from "#/modules/identity/index.ts";
import { Mailer } from "#/modules/mail/index.ts";
import { seedTodos, TodosModule } from "#/modules/todos/index.ts";
import { TransactionPostgres } from "#/modules/transaction/index.ts";
import { seedUsers, Users, UsersModule } from "#/modules/users/index.ts";

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
const SeedApi = Layer.mergeAll(TodosModule, UsersModule).pipe(
  Layer.provideMerge(IdentityModule),
  Layer.provideMerge(Users.layer),
  Layer.provide([
    TransactionPostgres,
    Layer.succeed(Mailer, Mailer.of({ send: () => Effect.void })),
  ]),
  Layer.provideMerge(HttpServer.layerServices),
  Layer.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ PUBLIC_URL: "http://localhost" })),
  ),
);

// As the clients of the testing module, which the seed, run outside tests, cannot import.
const withCookie = (cookie: string | undefined) =>
  HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
    next(cookie === undefined ? request : HttpClientRequest.setHeader(request, "cookie", cookie)),
  );

const password = Redacted.make(devPassword);

const paris = Schema.decodeSync(TimeZone)("Europe/Paris");

const visitor = HttpApiTest.groups(Api, ["identity"]).pipe(Effect.provide(withCookie(undefined)));

const clientWithSession = (response: { readonly cookies: Cookies.Cookies }) => {
  const session = Cookies.getValue(response.cookies, "session");

  return HttpApiTest.groups(Api, ["identity", "todos", "users"]).pipe(
    Effect.provide(
      withCookie(Option.getOrUndefined(Option.map(session, (token) => `session=${token}`))),
    ),
  );
};

const profileOf: Readonly<Record<Role, { readonly firstName: string; readonly jobTitle: string }>> =
  {
    user: { firstName: "User", jobTitle: "Member" },
    admin: { firstName: "Admin", jobTitle: "Administrator" },
  };

/**
 * Signs the dev account up and fills in its Profile, through the Api as a browser would. An Admin is no Role an
 * endpoint gives: `Users` gives it, as nothing else can make the first one.
 */
const seedDevAccount = Effect.fn("seedDevAccount")(function* (role: Role) {
  const [user, response] = yield* (yield* visitor).identity.signUp({
    payload: {
      email: Email.make(devAccounts[role]),
      password,
      timeZone: paris,
    },
    responseMode: "decoded-and-response",
  });

  const client = yield* clientWithSession(response);
  const { firstName, jobTitle } = profileOf[role];
  const name = { firstName, lastName: "Quack" };
  yield* client.users.completeOnboarding({ payload: name });
  yield* client.users.updateProfile({
    payload: new Profile({
      ...name,
      avatarUrl: null,
      jobTitle,
      team: "operations",
      country: CountryCode.make("FR"),
    }),
  });

  if (role === "admin") yield* (yield* Users).grantRole(user.id, role);

  return client;
});

// The dev accounts and their Todos go through the Api: the seed makes no state the Api can make.
const seedDevAccounts = Effect.forEach(
  Role.literals,
  (role) => Effect.flatMap(seedDevAccount(role), ({ todos }) => seedTodos(todos)),
  { discard: true },
).pipe(Effect.provide(SeedApi));

const reset = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(
    truncateTables.pipe(Effect.andThen(seedUsers), Effect.andThen(seedDevAccounts), Effect.scoped),
  );
});

export const seedDatabase = Effect.fn("seedDatabase")(function* (config: DatabaseSettings) {
  const url = Redacted.value(config.url);

  if (!isLocalDatabaseUrl(url)) {
    return yield* new NotLocalDatabase({ url: withoutPassword(url) });
  }

  yield* reset.pipe(Effect.provide(IdentityPostgres.pipe(Layer.provideMerge(databaseAt(config)))));
});
