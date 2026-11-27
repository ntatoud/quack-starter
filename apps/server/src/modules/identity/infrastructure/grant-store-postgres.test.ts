import { assert, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";
import { describe } from "vite-plus/test";

import { GrantStore } from "#/modules/identity/domain/grant-store.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { GrantStorePostgres } from "#/modules/identity/infrastructure/grant-store-postgres.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";
import { grantStoreSuite } from "#/modules/identity/testing/grant-store-suite.ts";
import { aUser, TestDatabase } from "#/modules/testing/index.ts";

const aUserId = Effect.map(aUser(), ({ id }) => id);

const Postgres = Layer.mergeAll(GrantStorePostgres, UserRepositoryPostgres).pipe(
  Layer.provide(TestDatabase),
);

describe("GrantStorePostgres", () => {
  grantStoreSuite(Postgres, aUserId);

  it.effect("removing a User removes their Grants and tokens", () =>
    Effect.gen(function* () {
      const store = yield* GrantStore;
      const userId = yield* aUserId;

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
      assert.isTrue(Option.isNone(yield* store.findByRefreshToken(refreshTokenHash)));
    }).pipe(Effect.provide(Postgres)),
  );
});
