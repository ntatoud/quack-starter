import { NodeCrypto } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Email, Password } from "@quack/contracts/identity/user";
import { ConfigProvider, Effect, Layer, Schema } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { devUsers, UserSeed } from "#/modules/identity/application/user-seed.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";

const seeds = [
  { email: "ada@example.com", password: "correct horse battery staple", role: "admin" as const },
  { email: "grace@example.com", password: "another long passphrase", role: "user" as const },
].map(({ email, password, role }) => ({
  email: Schema.decodeSync(Email)(email),
  password: Schema.decodeSync(Password)(password),
  role,
}));

const SeededIdentity = Layer.mergeAll(Identity.layer, UserSeed(seeds), UserSeed(seeds)).pipe(
  Layer.provide([
    UserRepositoryMemory,
    PasswordHasherArgon2,
    SessionStoreMemory,
    AttemptLimiterMemory.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))),
  ]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest, NodeCrypto.layerKdf]),
);

layer(SeededIdentity)("UserSeed", (it) => {
  it.effect(
    "creates Users of their Role who sign in with their password, even when seeded twice",
    () =>
      Effect.gen(function* () {
        const identity = yield* Identity;

        for (const { email, password, role } of seeds) {
          const { user } = yield* identity.signIn(email, password, "203.0.113.1");
          assert.strictEqual(user.email, email);
          assert.strictEqual(user.role, role);
        }
      }),
  );

  it.effect(
    "seeds admin@quack.dev as the only admin, then user@quack.dev and 100 other Users, each with an email of its own",
    () =>
      Effect.sync(() => {
        const emails = devUsers.map(({ email }) => email);

        assert.deepStrictEqual(emails.slice(0, 2), ["admin@quack.dev", "user@quack.dev"]);
        assert.strictEqual(new Set(emails).size, 102);
        assert.deepStrictEqual(
          devUsers.filter(({ role }) => role === "admin").map(({ email }) => email),
          ["admin@quack.dev"],
        );
      }),
  );
});
