import { NodeCrypto } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { Email, Password } from "@quack/contracts/identity/user";
import { ConfigProvider, DateTime, Effect, Layer, Schema } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { seedDate } from "#/database/seed-date.ts";
import {
  devAccountIds,
  devPasswordHash,
  devUsers,
} from "#/modules/identity/application/identity-seed.ts";
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

describe("devUsers", () => {
  it("gives the same Users, ids and dates included, at every run", () => {
    assert.deepStrictEqual(devUsers(), devUsers());
    // Noted from an earlier run, in another process.
    const [admin, , firstRandom] = devUsers();
    assert.strictEqual(admin?.id, "6b042125-686a-43e0-8a68-23cf5bee102e");
    assert.strictEqual(firstRandom?.id, "62e5cbe9-c54e-46fa-b91f-7963e90958e5");
    assert.strictEqual(firstRandom?.email, "ansel_larkin90@yahoo.com");
  });

  it("gives admin@quack.dev as the only admin, then user@quack.dev and 100 other Users, each with an id and an email of its own", () => {
    const seeded = devUsers();

    assert.deepStrictEqual(
      seeded.slice(0, 2).map(({ email }) => email),
      ["admin@quack.dev", "user@quack.dev"],
    );
    assert.strictEqual(new Set(seeded.map(({ email }) => email)).size, 102);
    assert.strictEqual(new Set(seeded.map(({ id }) => id)).size, 102);
    assert.deepStrictEqual(
      seeded.filter(({ role }) => role === "admin").map(({ email }) => email),
      ["admin@quack.dev"],
    );
  });

  it("gives Users of every status, the dev accounts active", () => {
    const seeded = devUsers();

    assert.deepStrictEqual([...new Set(seeded.map(({ status }) => status))].toSorted(), [
      "active",
      "invited",
      "suspended",
    ]);
    assert.deepStrictEqual(
      seeded.slice(0, 2).map(({ status }) => status),
      ["active", "active"],
    );
  });

  it("gives Users created before the seed date, the invited never signed in", () => {
    const seedMillis = seedDate.getTime();

    for (const { status, createdAt, lastSignInAt } of devUsers()) {
      assert.isAtMost(DateTime.toEpochMillis(createdAt), seedMillis);

      if (lastSignInAt !== null) {
        assert.isAtLeast(DateTime.toEpochMillis(lastSignInAt), DateTime.toEpochMillis(createdAt));
        assert.isAtMost(DateTime.toEpochMillis(lastSignInAt), seedMillis);
      }

      assert.strictEqual(lastSignInAt === null, status === "invited");
    }
  });

  it("gives an onboarding date to the Users with a Profile who signed in, and to them only", () => {
    for (const { profile, lastSignInAt, onboardedAt, createdAt } of devUsers()) {
      assert.strictEqual(onboardedAt !== null, profile !== null && lastSignInAt !== null);

      if (onboardedAt !== null) {
        assert.isAtLeast(DateTime.toEpochMillis(onboardedAt), DateTime.toEpochMillis(createdAt));
      }
    }
  });

  it("gives a Profile to most Users, not all", () => {
    const seeded = devUsers();
    const withProfile = seeded.filter(({ profile }) => profile !== null);

    assert.isAbove(withProfile.length, seeded.length / 2);
    assert.isBelow(withProfile.length, seeded.length);
  });
});

describe("devAccountIds", () => {
  it("gives the ids of admin@quack.dev and user@quack.dev among the seeded Users", () => {
    const emailsById = new Map(devUsers().map(({ id, email }) => [id, email]));

    assert.deepStrictEqual(
      devAccountIds().map((id) => String(emailsById.get(id))),
      ["admin@quack.dev", "user@quack.dev"],
    );
  });
});
