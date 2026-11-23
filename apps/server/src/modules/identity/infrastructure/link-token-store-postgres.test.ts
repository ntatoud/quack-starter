import { Email, User } from "@quack/contracts/identity/user";
import { DateTime, Effect, Layer, Redacted } from "effect";
import { describe } from "vite-plus/test";

import { databaseAt } from "#/database/database.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { LinkTokenStorePostgres } from "#/modules/identity/infrastructure/link-token-store-postgres.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";
import { linkTokenStoreSuite } from "#/modules/identity/testing/link-token-store-suite.ts";

// A database of its own, which these tests migrate and fill: never one a server uses.
const url = process.env.TEST_DATABASE_URL;

const aUser = Effect.gen(function* () {
  const users = yield* UserRepository;
  const id = yield* users.nextId;

  yield* users.create(
    new User({
      id,
      email: Email.make(`${id}@example.com`),
      role: "user",
      status: "active",
      createdAt: yield* DateTime.now,
      lastSignInAt: null,
      onboardedAt: null,
      timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
      profile: null,
    }),
    "not a hash",
  );

  return id;
}).pipe(Effect.orDie);

const Postgres = Layer.mergeAll(LinkTokenStorePostgres, UserRepositoryPostgres).pipe(
  Layer.provide(databaseAt({ url: Redacted.make(url ?? ""), maxConnections: 2 })),
  Layer.orDie,
);

describe.skipIf(url === undefined)("LinkTokenStorePostgres", () => {
  linkTokenStoreSuite(Postgres, aUser);
});
