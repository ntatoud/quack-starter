import { createHash } from "node:crypto";

import { NodeCrypto } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Email, User } from "@quack/contracts/identity/user";
import { ConfigProvider, DateTime, Effect, Layer, Option, Redacted } from "effect";

import { TestClock } from "effect/testing";

import { Identity } from "#/modules/identity/application/identity.ts";
import { PasswordHasher } from "#/modules/identity/domain/password-hasher.ts";
import { SessionStore } from "#/modules/identity/domain/session-store.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { PasswordHasherArgon2 } from "#/modules/identity/infrastructure/password-hasher-argon2.ts";
import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";

const password = Redacted.make("correct horse battery staple");

/** Each test that reaches a limit takes an address of its own. */
const ip = "203.0.113.1";

const sha256Hex = (text: string) => createHash("sha256").update(text).digest("hex");

/** How many passwords the hasher hashed or verified: the slow step, which decides how long a sign-in takes. */
const hasherWork = { count: 0 };
const counted = <A>(effect: Effect.Effect<A>) =>
  Effect.suspend(() => {
    hasherWork.count += 1;
    return effect;
  });

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
  Layer.provide([
    PasswordHasherCounted,
    // The limits of an unset config, whatever the environment of the machine that runs the tests.
    AttemptLimiterMemory.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))),
  ]),
  // The stores stay visible, to see what a sign-up leaves in them.
  Layer.provideMerge([SessionStoreMemory, UserRepositoryMemory]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest, NodeCrypto.layerKdf]),
);

layer(IdentityLayer)("Identity", (it) => {
  it.effect("opens a Session with a token of 32 random bytes, in base64url", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;

      const first = yield* identity.signUp(Email.make("ada@example.com"), password, ip);
      const second = yield* identity.signUp(Email.make("grace@example.com"), password, ip);

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

      const { user, session } = yield* identity.signUp(
        Email.make("linus@example.com"),
        password,
        ip,
      );
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
      const { session } = yield* identity.signUp(Email.make("margaret@example.com"), password, ip);

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
        yield* identity.signUp(Email.make("grace.h@example.com"), password, ip);

        const before = hasherWork.count;
        yield* identity
          .signIn(Email.make("grace.h@example.com"), Redacted.make("not the password of grace"), ip)
          .pipe(Effect.flip);
        const forWrongPassword = hasherWork.count - before;
        yield* identity.signIn(Email.make("nobody@example.com"), password, ip).pipe(Effect.flip);
        const forUnknownEmail = hasherWork.count - before - forWrongPassword;

        assert.strictEqual(forWrongPassword, 1);
        assert.strictEqual(forUnknownEmail, 1);
      }),
  );

  it.effect("refuses a sign-in past the limit before any work on the password", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const email = Email.make("hedy@example.com");
      const from = "203.0.113.2";
      yield* identity.signUp(email, password, from);
      for (let failure = 0; failure < 5; failure++) {
        yield* identity
          .signIn(email, Redacted.make("not the password of hedy"), from)
          .pipe(Effect.flip);
      }

      const before = hasherWork.count;
      const error = yield* identity.signIn(email, password, from).pipe(Effect.flip);

      assert.strictEqual(error._tag, "TooManyAttempts");
      assert.strictEqual(hasherWork.count - before, 0);
    }),
  );

  it.effect("refuses a sign-up past the limit before the password is hashed", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const from = "203.0.113.3";
      for (let signUp = 0; signUp < 10; signUp++) {
        yield* identity.signUp(Email.make(`visitor-${signUp}@example.com`), password, from);
      }

      const before = hasherWork.count;
      const error = yield* identity
        .signUp(Email.make("visitor-10@example.com"), password, from)
        .pipe(Effect.flip);

      assert.strictEqual(error._tag, "TooManyAttempts");
      assert.strictEqual(hasherWork.count - before, 0);
    }),
  );

  it.effect("signs out: removes the Session from the store, so its token opens nothing", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const store = yield* SessionStore;
      const { session } = yield* identity.signUp(Email.make("radia@example.com"), password, ip);

      yield* identity.signOut(session.token);

      const stored = yield* store.findByTokenHash(sha256Hex(Redacted.value(session.token)));
      assert.isTrue(Option.isNone(stored));
      const error = yield* identity.authenticate(session.token).pipe(Effect.flip);
      assert.strictEqual(error._tag, "Unauthenticated");
    }),
  );

  it.effect("removes a Session that has expired from the store when it is read", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const store = yield* SessionStore;
      const { session } = yield* identity.signUp(Email.make("lynn@example.com"), password, ip);
      const tokenHash = sha256Hex(Redacted.value(session.token));
      yield* TestClock.adjust("30 days");
      assert.isTrue(Option.isSome(yield* store.findByTokenHash(tokenHash)));

      const error = yield* identity.authenticate(session.token).pipe(Effect.flip);

      assert.strictEqual(error._tag, "Unauthenticated");
      assert.isTrue(Option.isNone(yield* store.findByTokenHash(tokenHash)));
    }),
  );

  it.effect("extends no Session that left the store: a sign-out is not undone", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const store = yield* SessionStore;
      const { session } = yield* identity.signUp(Email.make("adele@example.com"), password, ip);
      const tokenHash = sha256Hex(Redacted.value(session.token));
      yield* identity.signOut(session.token);

      yield* store.extend(tokenHash, DateTime.addDuration(yield* DateTime.now, "30 days"));

      assert.isTrue(Option.isNone(yield* store.findByTokenHash(tokenHash)));
    }),
  );

  it.effect("signs out a token that opens no Session, and succeeds", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;

      yield* identity.signOut(Redacted.make("not-a-session-the-server-opened"));
      yield* identity.signOut(Redacted.make(""));
    }),
  );

  it.effect("records the sign-up, then each sign-in, as the last sign-in of the User", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const users = yield* UserRepository;
      const email = Email.make("katherine@example.com");
      const signedUpAt = yield* DateTime.now;

      const { user } = yield* identity.signUp(email, password, ip);
      assert.deepStrictEqual(user.lastSignInAt, signedUpAt);
      assert.deepStrictEqual(user.createdAt, signedUpAt);
      yield* TestClock.adjust("1 hour");
      const signedIn = yield* identity.signIn(email, password, ip);

      const signedInAt = DateTime.addDuration(signedUpAt, "1 hour");
      assert.deepStrictEqual(signedIn.user.lastSignInAt, signedInAt);
      assert.deepStrictEqual(signedIn.user.createdAt, signedUpAt);
      const stored = Option.getOrThrow(yield* users.findById(user.id));
      assert.deepStrictEqual(stored.lastSignInAt, signedInAt);
    }),
  );

  it.effect.each(["suspended", "invited"] as const)(
    "refuses the sign-in of a User %s, with their password, as it refuses a wrong one",
    (status) =>
      Effect.gen(function* () {
        const identity = yield* Identity;
        const users = yield* UserRepository;
        const email = Email.make(`${status}@example.com`);
        const { user } = yield* identity.signUp(email, password, ip);
        yield* users.update(new User({ ...user, status }));

        const before = hasherWork.count;
        const error = yield* identity.signIn(email, password, ip).pipe(Effect.flip);

        assert.strictEqual(error._tag, "InvalidCredentials");
        assert.strictEqual(hasherWork.count - before, 1);
      }),
  );

  it.effect("ends the Session of a User suspended after they signed in", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const users = yield* UserRepository;
      const store = yield* SessionStore;
      const { user, session } = yield* identity.signUp(
        Email.make("barbara@example.com"),
        password,
        ip,
      );
      yield* users.update(new User({ ...user, status: "suspended" }));

      const error = yield* identity.authenticate(session.token).pipe(Effect.flip);

      assert.strictEqual(error._tag, "Unauthenticated");
      const tokenHash = sha256Hex(Redacted.value(session.token));
      assert.isTrue(Option.isNone(yield* store.findByTokenHash(tokenHash)));
    }),
  );
});
