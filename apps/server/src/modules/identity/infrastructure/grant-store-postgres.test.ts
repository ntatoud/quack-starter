import { Email, User } from "@quack/contracts/identity/user";
import { assert, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Redacted } from "effect";
import { describe } from "vite-plus/test";

import { databaseAt } from "#/database/database.ts";
import { GrantStore } from "#/modules/identity/domain/grant-store.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { GrantStorePostgres } from "#/modules/identity/infrastructure/grant-store-postgres.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";
import { grantStoreSuite } from "#/modules/identity/testing/grant-store-suite.ts";

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
      profile: null,
    }),
    "not a hash",
  );

  return id;
}).pipe(Effect.orDie);

const Postgres = Layer.mergeAll(GrantStorePostgres, UserRepositoryPostgres).pipe(
  Layer.provide(databaseAt({ url: Redacted.make(url ?? ""), maxConnections: 2 })),
  Layer.orDie,
);

describe.skipIf(url === undefined)("GrantStorePostgres", () => {
  grantStoreSuite(Postgres, aUser);

  it.effect("removing a User removes their Grants and tokens", () =>
    Effect.gen(function* () {
      const store = yield* GrantStore;
      const userId = yield* aUser;

      const grant = yield* store.save({
        userId,
        aiClientId: "https://claude.ai/oauth/client.json",
        aiClientName: "Claude",
        redirectUri: "https://claude.ai/api/mcp/auth_callback",
        resource: "https://quack.test/api/mcp",
        permissions: ["todos:list"],
        expiresAt: DateTime.makeUnsafe("2026-02-01T00:00:00Z"),
      });

      const token = { grantId: grant.id, resource: grant.resource, permissions: grant.permissions };
      const [accessTokenHash, refreshTokenHash] = [crypto.randomUUID(), crypto.randomUUID()];
      yield* store.saveAccessToken({
        ...token,
        tokenHash: accessTokenHash,
        expiresAt: grant.expiresAt,
      });
      yield* store.saveRefreshToken({ ...token, tokenHash: refreshTokenHash, replaced: false });

      yield* (yield* UserRepository).remove(userId);

      assert.isTrue(Option.isNone(yield* store.findOf(userId, grant.aiClientId)));
      assert.isTrue(Option.isNone(yield* store.findByAccessToken(accessTokenHash)));
      assert.isTrue(Option.isNone(yield* store.replaceRefreshToken(refreshTokenHash)));
    }).pipe(Effect.provide(Postgres)),
  );
});
