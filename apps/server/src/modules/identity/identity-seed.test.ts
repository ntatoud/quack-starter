import { NodeCrypto } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { Email, Password } from "@quack/contracts/identity/user";
import { ConfigProvider, Effect, Layer, Schema } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { devPasswordHash } from "#/modules/identity/application/identity-seed.ts";
import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import { IdentitySeed } from "#/modules/identity/index.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStoreMemory } from "#/modules/identity/testing/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";

const password = Schema.decodeSync(Password)(devPassword);
const anotherPassword = Schema.decodeSync(Password)("another password");

const devEmails = Object.entries(devAccounts).map(
  ([role, email]) => [role, Schema.decodeSync(Email)(email)] as const,
);

const Crypto = Layer.mergeAll(
  NodeCrypto.layerSecureRandom,
  NodeCrypto.layerDigest,
  NodeCrypto.layerKdf,
);

layer(PasswordHasherArgon2.pipe(Layer.provide(Crypto)))("devPasswordHash", (it) => {
  it.effect("is a hash of the dev password", () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;

      assert.isTrue(yield* hasher.verify(password, devPasswordHash));
      assert.isFalse(yield* hasher.verify(anotherPassword, devPasswordHash));
    }),
  );
});

const SeededIdentity = Layer.mergeAll(Identity.layer, IdentitySeed, IdentitySeed).pipe(
  Layer.provide([
    UserRepositoryMemory,
    PasswordHasherArgon2,
    SessionStoreMemory,
    AttemptLimiterMemory.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))),
  ]),
  Layer.provide(Crypto),
);

layer(SeededIdentity)("IdentitySeed", (it) => {
  it.effect(
    "seeds the dev accounts, who sign in with the dev password, even when seeded twice",
    () =>
      Effect.gen(function* () {
        const identity = yield* Identity;

        for (const [role, email] of devEmails) {
          const { user } = yield* identity.signIn(email, password, "203.0.113.1");
          assert.strictEqual(user.role, role);
        }
      }),
  );
});
