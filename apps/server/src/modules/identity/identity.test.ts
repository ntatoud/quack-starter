import { createHash } from "node:crypto";

import { NodeCrypto } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Email } from "@quack/contracts/identity/user";
import { DateTime, Effect, Layer, Option, Redacted } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import { SessionStore } from "#/modules/identity/domain/session-store.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";

const password = Redacted.make("correct horse battery staple");

const sha256Hex = (text: string) => createHash("sha256").update(text).digest("hex");

/** How many passwords the hasher hashed or verified: the slow step, which decides how long a sign-in takes. */
const hasherWork = { count: 0 };
const counted = <A>(effect: Effect.Effect<A>) =>
  Effect.suspend(() => {
    hasherWork.count += 1;
    return effect;
  });

/** The real hasher, counted. */
const PasswordHasherCounted = Layer.effect(
  PasswordHasher,
  Effect.map(Effect.service(PasswordHasher), (hasher) =>
    PasswordHasher.of({
      hash: (plain) => counted(hasher.hash(plain)),
      verify: (plain, hash) => counted(hasher.verify(plain, hash)),
    }),
  ),
).pipe(Layer.provide(PasswordHasherArgon2));

const IdentityLayer = Identity.layer.pipe(
  Layer.provide([UserRepositoryMemory, PasswordHasherCounted]),
  // The store stays visible, to see what a sign-up leaves in it.
  Layer.provideMerge(SessionStoreMemory),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest, NodeCrypto.layerKdf]),
);

layer(IdentityLayer)("Identity", (it) => {
  it.effect("opens a Session with a token of 32 random bytes, in base64url", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;

      const first = yield* identity.signUp(Email.make("ada@example.com"), password);
      const second = yield* identity.signUp(Email.make("grace@example.com"), password);

      // 32 bytes are 43 characters of base64url, which has no padding.
      assert.match(Redacted.value(first.session.token), /^[A-Za-z0-9_-]{43}$/);
      assert.notStrictEqual(
        Redacted.value(first.session.token),
        Redacted.value(second.session.token),
      );
    }),
  );

  it.effect("stores the SHA-256 of the token, never the token", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const store = yield* SessionStore;

      const { user, session } = yield* identity.signUp(Email.make("linus@example.com"), password);
      const token = Redacted.value(session.token);

      const stored = yield* store.findByTokenHash(sha256Hex(token));
      assert.strictEqual(Option.getOrThrow(stored).userId, user.id);
      assert.isTrue(Option.isNone(yield* store.findByTokenHash(token)));
    }),
  );

  it.effect("records that the Session expires 30 days after it is created", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const store = yield* SessionStore;

      // The test clock starts at the epoch.
      const { session } = yield* identity.signUp(Email.make("margaret@example.com"), password);

      const thirtyDays = DateTime.makeUnsafe("1970-01-31T00:00:00Z");
      assert.deepStrictEqual(session.expiresAt, thirtyDays);
      const stored = yield* store.findByTokenHash(sha256Hex(Redacted.value(session.token)));
      assert.deepStrictEqual(Option.getOrThrow(stored).expiresAt, thirtyDays);
    }),
  );

  it.effect(
    "does the work of a password check for an email no User has, so the answer takes as long",
    () =>
      Effect.gen(function* () {
        const identity = yield* Identity;
        yield* identity.signUp(Email.make("grace.h@example.com"), password);

        const before = hasherWork.count;
        yield* identity
          .signIn(Email.make("grace.h@example.com"), Redacted.make("not the password of grace"))
          .pipe(Effect.flip);
        const forWrongPassword = hasherWork.count - before;
        yield* identity.signIn(Email.make("nobody@example.com"), password).pipe(Effect.flip);
        const forUnknownEmail = hasherWork.count - before - forWrongPassword;

        assert.strictEqual(forWrongPassword, 1);
        assert.strictEqual(forUnknownEmail, 1);
      }),
  );

  it.effect("signs out: removes the Session from the store, so its token opens nothing", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const store = yield* SessionStore;
      const { session } = yield* identity.signUp(Email.make("radia@example.com"), password);

      yield* identity.signOut(session.token);

      const stored = yield* store.findByTokenHash(sha256Hex(Redacted.value(session.token)));
      assert.isTrue(Option.isNone(stored));
      const error = yield* identity.authenticate(session.token).pipe(Effect.flip);
      assert.strictEqual(error._tag, "Unauthenticated");
    }),
  );

  it.effect("signs out a token that opens no Session, and succeeds", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;

      yield* identity.signOut(Redacted.make("not-a-session-the-server-opened"));
      yield* identity.signOut(Redacted.make(""));
    }),
  );
});
