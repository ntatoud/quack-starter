import { NodeCrypto } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";

import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";

const password = Redacted.make("correct horse battery staple");

// Computed apart from the adapter, with `argon2Sync` of node:crypto and the salt 00 01 02 ... 0f.
const knownHash =
  "$argon2id$v=19$m=19456,t=2,p=1$AAECAwQFBgcICQoLDA0ODw$gYJZtjEAJqjg26xdLmknq8/bB7MiWPrE9hsYuA+SkIU";

// The same password and salt, hashed with other costs.
const knownHashOtherCosts =
  "$argon2id$v=19$m=8192,t=3,p=1$AAECAwQFBgcICQoLDA0ODw$lHMS9i5KyG9jybYi8UewBhhGc59T3QDy0iNs0D20E6w";

layer(
  PasswordHasherArgon2.pipe(Layer.provide([NodeCrypto.layerKdf, NodeCrypto.layerSecureRandom])),
)("PasswordHasherArgon2", (it) => {
  it.effect("verifies the password it hashed, and rejects another one", () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;

      const hash = yield* hasher.hash(password);

      assert.isTrue(yield* hasher.verify(password, hash));
      assert.isFalse(yield* hasher.verify(Redacted.make("correct horse battery stable"), hash));
    }),
  );

  it.effect("stores a PHC string: argon2id, m=19456, t=2, p=1, a 16 byte salt, a 32 byte tag", () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;

      const hash = yield* hasher.hash(password);

      // Base64 without padding: 16 bytes are 22 characters, 32 bytes are 43.
      assert.match(
        hash,
        /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
      );
    }),
  );

  it.effect("salts each hash", () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;

      assert.notStrictEqual(yield* hasher.hash(password), yield* hasher.hash(password));
    }),
  );

  it.effect("verifies a hash made by another argon2id implementation", () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;

      assert.isTrue(yield* hasher.verify(password, knownHash));
      assert.isFalse(yield* hasher.verify(Redacted.make("another password"), knownHash));
    }),
  );

  it.effect("verifies with the costs the hash carries, not the current ones", () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;

      assert.isTrue(yield* hasher.verify(password, knownHashOtherCosts));
    }),
  );

  it.effect.each(["", "not a hash", "$2b$10$abcdefghijklmnopqrstuv", knownHash.slice(0, -1)])(
    "rejects the hash %j, which it cannot read",
    (hash) =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher;

        assert.isFalse(yield* hasher.verify(password, hash));
      }),
  );
});
