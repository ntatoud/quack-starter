import { createHash } from "node:crypto";

import { NodeCrypto } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Email } from "@quack/contracts/identity/user";
import {
  ConfigProvider,
  DateTime,
  Effect,
  Exit,
  Layer,
  Logger,
  Option,
  Redacted,
  References,
} from "effect";

import { TestClock } from "effect/testing";

import { Identity } from "#/modules/identity/application/identity.ts";
import { SessionStore } from "#/modules/identity/domain/session-store.ts";
import { AttemptLimiterMemory } from "#/modules/identity/infrastructure/attempt-limiter-memory.ts";
import { IdentityPostgres } from "#/modules/identity/index.ts";
import { setStatus, TestDatabase } from "#/modules/testing/index.ts";
import { Users } from "#/modules/users/index.ts";

const password = Redacted.make("correct horse battery staple");

const paris = DateTime.zoneMakeNamedUnsafe("Europe/Paris");

/** Another address at each call, so no limit is reached but by the tests of the limits, at addresses of their own. */
let addresses = 0;
const anAddress = () => `2001:db8::${(addresses += 1).toString(16)}`;

const sha256Hex = (text: string) => createHash("sha256").update(text).digest("hex");

/** How `effect` ends, and what it logs on the way, each line as its message and the User it names. */
const loggedBy = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const lines: Array<{ message: unknown; userId: unknown }> = [];

    const logger = Logger.make(({ message, fiber }) => {
      lines.push({
        message: Array.isArray(message) && message.length === 1 ? message[0] : message,
        userId: fiber.getRef(References.CurrentLogAnnotations)["userId"],
      });
    });

    const exit = yield* Effect.exit(effect).pipe(Effect.provide(Logger.layer([logger])));

    return { exit, lines };
  });

const IdentityLayer = Identity.layer.pipe(
  Layer.provide([
    // The limits of an unset config, whatever the environment of the machine that runs the tests.
    AttemptLimiterMemory.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))),
  ]),
  // The stores stay visible, to see what a sign-up leaves in them.
  Layer.provideMerge([Users.layer, IdentityPostgres]),
  Layer.provide([NodeCrypto.layerSecureRandom, NodeCrypto.layerDigest]),
  Layer.provideMerge(TestDatabase),
);

layer(IdentityLayer)("Identity", (it) => {
  it.effect("opens a Session with a token of 32 random bytes, in base64url", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;

      const first = yield* identity.signUp(
        Email.make("ada@example.com"),
        password,
        paris,
        anAddress(),
      );

      const second = yield* identity.signUp(
        Email.make("grace@example.com"),
        password,
        paris,
        anAddress(),
      );

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
        paris,
        anAddress(),
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

      const now = yield* DateTime.now;

      const { session } = yield* identity.signUp(
        Email.make("margaret@example.com"),
        password,
        paris,
        anAddress(),
      );

      const thirtyDays = DateTime.add(now, { days: 30 });
      assert.deepStrictEqual(session.expiresAt, thirtyDays);
      const stored = yield* store.findByTokenHash(sha256Hex(Redacted.value(session.token)));
      assert.deepStrictEqual(Option.getOrThrow(stored).expiresAt, thirtyDays);
    }),
  );

  it.effect("refuses a sign-in past the limit before any work on the password", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const email = Email.make("hedy@example.com");
      const from = "203.0.113.2";
      yield* identity.signUp(email, password, paris, from);

      for (let failure = 0; failure < 5; failure++) {
        yield* identity
          .signIn(email, Redacted.make("not the password of hedy"), from)
          .pipe(Effect.flip);
      }

      const error = yield* identity.signIn(email, password, from).pipe(Effect.flip);

      assert.strictEqual(error._tag, "TooManyAttempts");
    }),
  );

  it.effect("refuses a sign-up past the limit before the password is hashed", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const from = "203.0.113.3";

      for (let signUp = 0; signUp < 10; signUp++) {
        yield* identity.signUp(Email.make(`visitor-${signUp}@example.com`), password, paris, from);
      }

      const error = yield* identity
        .signUp(Email.make("visitor-10@example.com"), password, paris, from)
        .pipe(Effect.flip);

      assert.strictEqual(error._tag, "TooManyAttempts");
    }),
  );

  it.effect("signs out: removes the Session from the store, so its token opens nothing", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const store = yield* SessionStore;

      const { session } = yield* identity.signUp(
        Email.make("radia@example.com"),
        password,
        paris,
        anAddress(),
      );

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

      const { session } = yield* identity.signUp(
        Email.make("lynn@example.com"),
        password,
        paris,
        anAddress(),
      );

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

      const { session } = yield* identity.signUp(
        Email.make("adele@example.com"),
        password,
        paris,
        anAddress(),
      );

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
      const users = yield* Users;
      const email = Email.make("katherine@example.com");
      const signedUpAt = yield* DateTime.now;

      const { user } = yield* identity.signUp(email, password, paris, anAddress());
      assert.deepStrictEqual(user.lastSignInAt, signedUpAt);
      assert.deepStrictEqual(user.createdAt, signedUpAt);
      yield* TestClock.adjust("1 hour");
      const signedIn = yield* identity.signIn(email, password, anAddress());

      const signedInAt = DateTime.addDuration(signedUpAt, "1 hour");
      assert.deepStrictEqual(signedIn.user.lastSignInAt, signedInAt);
      assert.deepStrictEqual(signedIn.user.createdAt, signedUpAt);
      const stored = Option.getOrThrow(yield* users.find({ id: user.id }));
      assert.deepStrictEqual(stored.lastSignInAt, signedInAt);
    }),
  );

  it.effect.each(["suspended", "invited"] as const)(
    "refuses the sign-in of a User %s, with their password, as it refuses a wrong one",
    (status) =>
      Effect.gen(function* () {
        const identity = yield* Identity;
        const email = Email.make(`${status}@example.com`);
        const { user } = yield* identity.signUp(email, password, paris, anAddress());
        yield* setStatus(user.id, status);

        const error = yield* identity.signIn(email, password, anAddress()).pipe(Effect.flip);

        assert.strictEqual(error._tag, "InvalidCredentials");
      }),
  );

  it.effect(
    "logs the refusal of a User suspended, with their password, but not of a wrong one",
    () =>
      Effect.gen(function* () {
        const identity = yield* Identity;
        const email = Email.make("logged.suspended@example.com");
        const { user } = yield* identity.signUp(email, password, paris, anAddress());
        yield* setStatus(user.id, "suspended");

        const refused = yield* loggedBy(identity.signIn(email, password, anAddress()));

        const wrong = yield* loggedBy(
          identity.signIn(email, Redacted.make("not-the-password"), anAddress()),
        );

        assert.deepStrictEqual(refused.lines, [
          { message: "Refused a User suspended", userId: user.id },
        ]);
        assert.deepStrictEqual(wrong.lines, []);
      }),
  );

  it.effect("ends the Session of a User suspended after they signed in", () =>
    Effect.gen(function* () {
      const identity = yield* Identity;
      const store = yield* SessionStore;

      const { user, session } = yield* identity.signUp(
        Email.make("barbara@example.com"),
        password,
        paris,
        anAddress(),
      );

      yield* setStatus(user.id, "suspended");

      const { exit, lines } = yield* loggedBy(identity.authenticate(session.token));

      assert.deepStrictEqual(
        Option.map(Exit.findErrorOption(exit), (error) => error._tag),
        Option.some("Unauthenticated"),
      );
      assert.deepStrictEqual(lines, [{ message: "Refused a User suspended", userId: user.id }]);
      const tokenHash = sha256Hex(Redacted.value(session.token));
      assert.isTrue(Option.isNone(yield* store.findByTokenHash(tokenHash)));
    }),
  );
});
