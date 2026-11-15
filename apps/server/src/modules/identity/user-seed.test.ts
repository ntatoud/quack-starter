import { NodeCrypto } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { devUsers, UserSeed } from "#/modules/identity/application/user-seed.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";

const SeededIdentity = Layer.mergeAll(Identity.layer, UserSeed(devUsers), UserSeed(devUsers)).pipe(
  Layer.provide([
    UserRepositoryMemory,
    PasswordHasherArgon2,
    SessionStoreMemory,
    AttemptLimiterMemory.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))),
  ]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest, NodeCrypto.layerKdf]),
);

layer(SeededIdentity)("UserSeed", (it) => {
  it.effect("creates Users who sign in with their password, even when seeded twice", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;

      for (const { email, password } of devUsers) {
        const { user } = yield* identity.signIn(email, password, "203.0.113.1");
        assert.strictEqual(user.email, email);
      }
    }),
  );
});
