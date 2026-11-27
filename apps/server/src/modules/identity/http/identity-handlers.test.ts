import { assert, describe, effect, layer } from "@effect/vitest";
import { type Email, type Password, TimeZone } from "@quack/contracts/identity/user";
import {
  Clock,
  DateTime,
  ConfigProvider,
  Duration,
  Effect,
  Exit,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import { HttpServer } from "effect/http";
import { TestClock } from "effect/testing";

import { sessionExtensionThreshold, sessionLifetime } from "#/modules/identity/domain/session.ts";
import { IdentityModule, IdentityPostgres } from "#/modules/identity/index.ts";
import { emailChangeModelWalks } from "#/modules/identity/testing/email-change-model.ts";
import { sessionModelWalks } from "#/modules/identity/testing/session-model.ts";
import { MailerMemory, SentMails } from "#/modules/mail/index.ts";
import { aUser, makeBrowser, setStatus, TestDatabase } from "#/modules/testing/index.ts";
import { TransactionPostgres } from "#/modules/transaction/index.ts";
import { Users } from "#/modules/users/index.ts";

const maxAge = Duration.toSeconds(sessionLifetime);

const password = Redacted.make("correct horse battery staple");

/** The email as typed, not normalized: the server must normalize it. */
const asTyped = (email: string) => email as Email;

const assertCookieCleared = (setCookie: ReadonlyArray<string>) => {
  assert.lengthOf(setCookie, 1);
  assert.match(setCookie[0] ?? "", /^session=; .*Max-Age=0/);
};

const withConfig = (env: Record<string, string>) =>
  IdentityModule.pipe(
    // Visible, to add Users of every Status and to read the mails sent.
    Layer.provideMerge([Users.layer, IdentityPostgres, TransactionPostgres, MailerMemory]),
    Layer.provideMerge(HttpServer.layerServices),
    Layer.provideMerge(TestDatabase),
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({ PUBLIC_URL: "https://quack.test/ignored", ...env }),
      ),
    ),
  );

// Every browser of these tests has the same address, none, and they sign up more than 10 times in the hour.
layer(withConfig({ SIGN_UPS_PER_IP: "1000" }))("IdentityApi", (it) => {
  it.effect("signs a visitor up as a user, and answers with their public User", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const { user } = yield* browser.signUp(asTyped("ada@example.com"));

      assert.strictEqual(user.email, "ada@example.com");
      assert.isAbove(user.id.length, 0);
      assert.strictEqual(user.role, "user");
      assert.deepStrictEqual(Object.keys(user).toSorted(), [
        "createdAt",
        "email",
        "id",
        "lastSignInAt",
        "onboardedAt",
        "profile",
        "role",
        "status",
        "timeZone",
      ]);
    }),
  );

  it.effect("keeps the time zone the browser sent at sign-up", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      const tokyo = yield* Schema.decodeEffect(TimeZone)("Asia/Tokyo");

      const { user } = yield* browser.signUp(asTyped("ada.tokyo@example.com"), tokyo);

      assert.strictEqual(DateTime.zoneToString(user.timeZone), "Asia/Tokyo");
      assert.strictEqual(DateTime.zoneToString((yield* browser.me).timeZone), "Asia/Tokyo");
    }),
  );

  it.effect("signs the visitor in as soon as they sign up: me answers with their User", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const { user } = yield* browser.signUp(asTyped("grace@example.com"));

      assert.deepStrictEqual(yield* browser.me, user);
    }),
  );

  it.effect("normalizes the email: trimmed and lowercased", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const { user } = yield* browser.signUp(asTyped("  Linus@Example.COM "));

      assert.strictEqual(user.email, "linus@example.com");
      assert.strictEqual((yield* browser.me).email, "linus@example.com");
    }),
  );

  it.effect("fails with EmailAlreadyTaken when a User has this email", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("margaret@example.com"));

      const error = yield* browser.signUp(asTyped("margaret@example.com")).pipe(Effect.flip);

      assert.strictEqual(error._tag, "EmailAlreadyTaken");
    }),
  );

  it.effect("fails with EmailAlreadyTaken for the same email in another case", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("barbara@example.com"));

      const error = yield* browser.signUp(asTyped(" Barbara@EXAMPLE.com")).pipe(Effect.flip);

      assert.strictEqual(error._tag, "EmailAlreadyTaken");
    }),
  );

  it.effect(
    "signs a User in with their email and password, and answers with their public User",
    () =>
      Effect.gen(function* () {
        const { user } = yield* (yield* makeBrowser).signUp(asTyped("hedy@example.com"));
        const browser = yield* makeBrowser;

        const signedIn = yield* browser.signIn(asTyped(" Hedy@Example.com"));

        assert.deepStrictEqual({ ...signedIn.user, lastSignInAt: user.lastSignInAt }, { ...user });
        assert.deepStrictEqual(Object.keys(signedIn.user).toSorted(), [
          "createdAt",
          "email",
          "id",
          "lastSignInAt",
          "onboardedAt",
          "profile",
          "role",
          "status",
          "timeZone",
        ]);
        assert.deepStrictEqual(yield* browser.me, user);
      }),
  );

  it.effect("fails a sign-in with InvalidCredentials when the password is not the User's", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* (yield* makeBrowser).signUp(asTyped("annie@example.com"));

      const error = yield* browser
        .signIn(asTyped("annie@example.com"), Redacted.make("not the password of annie"))
        .pipe(Effect.flip);

      assert.strictEqual(error._tag, "InvalidCredentials");
      assert.isTrue(Option.isNone(yield* browser.session));
    }),
  );

  it.effect("fails a sign-in the same way when no User has this email", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* (yield* makeBrowser).signUp(asTyped("joan@example.com"));

      const wrongPassword = yield* browser
        .signIn(asTyped("joan@example.com"), Redacted.make("not the password of joan"))
        .pipe(Effect.flip);

      const unknownEmail = yield* browser.signIn(asTyped("nobody@example.com")).pipe(Effect.flip);

      assert.strictEqual(unknownEmail._tag, "InvalidCredentials");
      assert.deepStrictEqual(unknownEmail, wrongPassword);
    }),
  );

  it.effect("opens a new Session at every sign-in, and leaves the previous one open", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      const { user } = yield* browser.signUp(asTyped("frances@example.com"));
      const atSignUp = Option.getOrThrow(yield* browser.session);

      // A sign-in with a valid session cookie on the request is tested on the routes, in `server.test.ts`:
      // this client sends the cookie to the endpoints that declare `Authentication` only.
      yield* browser.signIn(asTyped("frances@example.com"));
      const atFirstSignIn = Option.getOrThrow(yield* browser.session);
      yield* browser.signIn(asTyped("frances@example.com"));
      const atSecondSignIn = Option.getOrThrow(yield* browser.session);

      assert.lengthOf(new Set([atSignUp, atFirstSignIn, atSecondSignIn]), 3);

      for (const session of [atSignUp, atFirstSignIn, atSecondSignIn]) {
        const other = yield* makeBrowser;
        yield* other.setCookie("session", session);
        assert.deepStrictEqual(yield* other.me, user);
      }
    }),
  );

  it.effect("sets the session cookie of a sign-in as the one of a sign-up", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("sophie@example.com"));

      const { setCookie } = yield* browser.signIn(asTyped("sophie@example.com"));

      assert.lengthOf(setCookie, 1);
      const [nameAndValue, ...attributes] = (setCookie[0] ?? "").split("; ");
      assert.match(nameAndValue ?? "", /^session=[A-Za-z0-9_-]{43}$/);
      assert.deepStrictEqual(attributes.toSorted(), [
        "HttpOnly",
        `Max-Age=${maxAge}`,
        "Path=/",
        "SameSite=Lax",
        "Secure",
      ]);
    }),
  );

  it.effect("signs out: clears the session cookie, so the browser has no Session", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("mary@example.com"));

      const { status, setCookie } = yield* browser.signOut;

      assert.strictEqual(status, 204);
      assert.lengthOf(setCookie, 1);
      const [nameAndValue, ...attributes] = (setCookie[0] ?? "").split("; ");
      assert.strictEqual(nameAndValue, "session=");
      // The attributes of the cookie it replaces, or the browser would keep that one.
      assert.includeMembers(attributes, [
        "Max-Age=0",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Secure",
      ]);
      assert.isTrue(Option.isNone(yield* browser.session));
      assert.strictEqual((yield* browser.me.pipe(Effect.flip))._tag, "Unauthenticated");
    }),
  );

  it.effect("signs out without a Session: succeeds, and clears the cookie all the same", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const { status, setCookie } = yield* browser.signOut;

      assert.strictEqual(status, 204);
      assertCookieCleared(setCookie);
    }),
  );

  it.effect("signs a visitor up as a User who has not completed the onboarding", () =>
    Effect.gen(function* () {
      const { user } = yield* (yield* makeBrowser).signUp(asTyped("new.ada@example.com"));

      assert.isNull(user.onboardedAt);
      assert.isNull(user.profile);
    }),
  );

  it.effect("fails me with Unauthenticated without a Session", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const error = yield* browser.me.pipe(Effect.flip);

      assert.strictEqual(error._tag, "Unauthenticated");
    }),
  );

  it.effect("fails me with Unauthenticated for a Session the server does not know", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.setCookie("session", "not-a-session-the-server-opened");

      const error = yield* browser.me.pipe(Effect.flip);

      assert.strictEqual(error._tag, "Unauthenticated");
    }),
  );

  it.effect(
    "fails me with Unauthenticated once the Session has expired: 30 days with no request",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        yield* browser.signUp(asTyped("katherine@example.com"));

        yield* TestClock.adjust("30 days");

        const error = yield* browser.me.pipe(Effect.flip);
        assert.strictEqual(error._tag, "Unauthenticated");
      }),
  );

  it.effect("keeps a Session open until it expires: one second before the 30 days", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      const { user } = yield* browser.signUp(asTyped("ida@example.com"));

      yield* TestClock.adjust(Duration.subtract(Duration.days(30), Duration.seconds(1)));

      assert.deepStrictEqual(yield* browser.me, user);
    }),
  );

  it.effect(
    "leaves a Session that has 15 days left or more as it is: no cookie, the same expiry",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        yield* browser.signUp(asTyped("evelyn@example.com"));

        yield* TestClock.adjust(sessionExtensionThreshold);
        const { status, setCookie } = yield* browser.meResponse;

        assert.strictEqual(status, 200);
        assert.deepStrictEqual(setCookie, []);

        yield* TestClock.adjust(Duration.subtract(sessionLifetime, sessionExtensionThreshold));
        assert.strictEqual((yield* browser.me.pipe(Effect.flip))._tag, "Unauthenticated");
      }),
  );

  it.effect(
    "extends the Session to 30 days when less than 15 days are left, and sets the cookie again",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        const { user } = yield* browser.signUp(asTyped("dorothy@example.com"));
        const token = Option.getOrThrow(yield* browser.session);

        yield* TestClock.adjust(Duration.sum(sessionExtensionThreshold, Duration.hours(1)));
        const { status, setCookie } = yield* browser.meResponse;

        assert.strictEqual(status, 200);
        assert.lengthOf(setCookie, 1);
        const [nameAndValue, ...attributes] = (setCookie[0] ?? "").split("; ");
        assert.strictEqual(nameAndValue, `session=${token}`);
        assert.deepStrictEqual(attributes.toSorted(), [
          "HttpOnly",
          `Max-Age=${maxAge}`,
          "Path=/",
          "SameSite=Lax",
          "Secure",
        ]);

        yield* TestClock.adjust(Duration.subtract(sessionLifetime, Duration.days(1)));
        assert.deepStrictEqual(yield* browser.me, user);
      }),
  );

  it.effect("keeps a Session open with no limit, as long as its User comes back", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      const { user } = yield* browser.signUp(asTyped("jean@example.com"));

      for (let visit = 0; visit < 10; visit++) {
        yield* TestClock.adjust("20 days");
        assert.deepStrictEqual(yield* browser.me, user);
      }
    }),
  );

  it.effect(
    "refuses the Session of a User deleted since they signed in, and clears its cookie",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        const { user } = yield* browser.signUp(asTyped("deleted.later@example.com"));
        const admin = yield* aUser({ role: "admin" });
        yield* (yield* Users).remove(user.id, admin.id);

        const { status, setCookie } = yield* browser.meResponse;

        assert.strictEqual(status, 401);
        assertCookieCleared(setCookie);
      }),
  );

  it.effect("clears the session cookie when the request has no Session", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const { status, setCookie } = yield* browser.meResponse;

      assert.strictEqual(status, 401);
      assert.lengthOf(setCookie, 1);
      const [nameAndValue, ...attributes] = (setCookie[0] ?? "").split("; ");
      assert.strictEqual(nameAndValue, "session=");
      // The attributes of the cookie it replaces, or the browser would keep that one.
      assert.includeMembers(attributes, [
        "Max-Age=0",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Secure",
      ]);
    }),
  );

  it.effect("clears the session cookie of a Session the server does not know", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.setCookie("session", "not-a-session-the-server-opened");

      const { status, setCookie } = yield* browser.meResponse;

      assert.strictEqual(status, 401);
      assertCookieCleared(setCookie);
      assert.isTrue(Option.isNone(yield* browser.session));
    }),
  );

  it.effect("clears the session cookie of a Session that has expired", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("adele@example.com"));
      const token = Option.getOrThrow(yield* browser.session);
      yield* TestClock.adjust("30 days");
      // A browser has dropped the cookie by now, at the end of its `Max-Age`: this client kept it.
      yield* browser.setCookie("session", token);

      const { status, setCookie } = yield* browser.meResponse;

      assert.strictEqual(status, 401);
      assertCookieCleared(setCookie);
      assert.isTrue(Option.isNone(yield* browser.session));
    }),
  );

  it.effect("removes a Session that has expired when it is read: it opens nothing ever after", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("lynn@example.com"));
      const token = Option.getOrThrow(yield* browser.session);
      const signedUpAt = yield* Clock.currentTimeMillis;
      yield* TestClock.adjust("30 days");
      assert.strictEqual((yield* browser.me.pipe(Effect.flip))._tag, "Unauthenticated");

      // The clock goes back to a time when the Session had not expired: a Session still in the store would open.
      yield* TestClock.setTime(signedUpAt);
      yield* browser.setCookie("session", token);

      assert.strictEqual((yield* browser.me.pipe(Effect.flip))._tag, "Unauthenticated");
    }),
  );

  it.effect(
    "sets the session cookie: HttpOnly, Secure, SameSite=Lax, Path=/, 30 days, no Domain",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;

        const { setCookie } = yield* browser.signUp(asTyped("radia@example.com"));

        assert.lengthOf(setCookie, 1);
        const [nameAndValue, ...attributes] = (setCookie[0] ?? "").split("; ");
        assert.match(nameAndValue ?? "", /^session=[A-Za-z0-9_-]{43}$/);
        assert.deepStrictEqual(attributes.toSorted(), [
          "HttpOnly",
          `Max-Age=${maxAge}`,
          "Path=/",
          "SameSite=Lax",
          "Secure",
        ]);
      }),
  );
});

layer(withConfig({ COOKIE_SECURE: "false" }))("IdentityApi, with COOKIE_SECURE=false", (it) => {
  it.effect(
    "sets and clears the session cookie without Secure, for an origin served over http",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;

        const signedUp = yield* browser.signUp(asTyped("ada@example.com"));
        yield* TestClock.adjust("16 days");
        const extended = yield* browser.meResponse;
        const signedOut = yield* browser.signOut;
        const refused = yield* browser.meResponse;

        for (const { setCookie } of [signedUp, extended, signedOut, refused]) {
          assert.lengthOf(setCookie, 1);
          assert.notInclude((setCookie[0] ?? "").split("; "), "Secure");
        }
      }),
  );
});

const wrongPassword = Redacted.make("not the password of anyone");

const withLimits = (env: Record<string, string> = {}) => Effect.provide(withConfig(env));

const refusal = (error: { readonly _tag: string; readonly retryAfter?: number } | undefined) => ({
  _tag: error?._tag,
  retryAfter: error?.retryAfter,
});

const failSignIn = (browser: Effect.Success<typeof makeBrowser>, email: string, times: number) =>
  Effect.forEach(Array.from({ length: times }), () =>
    Effect.flip(browser.signIn(asTyped(email), wrongPassword)),
  );

describe("IdentityApi, attempt limits", () => {
  effect("refuses a sign-in after 5 failures on the email in 15 minutes: TooManyAttempts", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("ada@example.com"));
      yield* browser.signUp(asTyped("grace@example.com"));

      const failures = yield* failSignIn(browser, "ada@example.com", 5);
      // The password is the right one: the answer does not depend on it.
      const error = yield* browser.signIn(asTyped(" Ada@Example.com ")).pipe(Effect.flip);

      assert.deepStrictEqual(
        failures.map((failure) => failure._tag),
        Array.from({ length: 5 }, () => "InvalidCredentials"),
      );
      assert.strictEqual(error._tag, "TooManyAttempts");
      assert.strictEqual(
        (yield* browser.signIn(asTyped("grace@example.com"))).user.email,
        "grace@example.com",
      );
    }).pipe(withLimits()),
  );

  effect("says how long to wait in retryAfter: the seconds left in the window", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* failSignIn(browser, "ada@example.com", 1);
      yield* TestClock.adjust("4 minutes");
      yield* failSignIn(browser, "ada@example.com", 4);

      const atOnce = yield* browser.signIn(asTyped("ada@example.com")).pipe(Effect.flip);
      yield* TestClock.adjust("10 minutes");
      yield* TestClock.adjust("59500 millis");
      const atTheEnd = yield* browser.signIn(asTyped("ada@example.com")).pipe(Effect.flip);

      assert.deepStrictEqual(refusal(atOnce), { _tag: "TooManyAttempts", retryAfter: 660 });
      assert.deepStrictEqual(refusal(atTheEnd), { _tag: "TooManyAttempts", retryAfter: 1 });
    }).pipe(withLimits()),
  );

  effect("counts the failures on an email no User has, and refuses it the same way", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("ada@example.com"));

      yield* failSignIn(browser, "ada@example.com", 5);
      const known = yield* browser.signIn(asTyped("ada@example.com")).pipe(Effect.flip);
      const failures = yield* failSignIn(browser, "nobody@example.com", 5);
      const unknown = yield* browser.signIn(asTyped("nobody@example.com")).pipe(Effect.flip);

      assert.strictEqual(failures[4]?._tag, "InvalidCredentials");
      assert.strictEqual(unknown._tag, "TooManyAttempts");
      assert.deepStrictEqual(refusal(unknown), refusal(known));
    }).pipe(withLimits()),
  );

  effect("sets the counter of the email back to zero when a sign-in succeeds", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("ada@example.com"));
      yield* failSignIn(browser, "ada@example.com", 4);

      yield* browser.signIn(asTyped("ada@example.com"));

      const failures = yield* failSignIn(browser, "ada@example.com", 5);
      assert.deepStrictEqual(
        failures.map((failure) => failure._tag),
        Array.from({ length: 5 }, () => "InvalidCredentials"),
      );
      const error = yield* browser.signIn(asTyped("ada@example.com")).pipe(Effect.flip);
      assert.strictEqual(error._tag, "TooManyAttempts");
    }).pipe(withLimits()),
  );

  effect("opens the next window when the 15 minutes end: the refusal is temporary", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      const { user } = yield* browser.signUp(asTyped("ada@example.com"));
      yield* failSignIn(browser, "ada@example.com", 5);

      yield* TestClock.adjust(Duration.subtract(Duration.minutes(15), Duration.seconds(1)));
      const refused = yield* failSignIn(browser, "ada@example.com", 3);
      yield* TestClock.adjust("1 second");

      assert.deepStrictEqual(refusal(refused[2]), { _tag: "TooManyAttempts", retryAfter: 1 });
      assert.strictEqual((yield* browser.signIn(asTyped("ada@example.com"))).user.id, user.id);
      const failures = yield* failSignIn(browser, "ada@example.com", 6);
      assert.strictEqual(failures[4]?._tag, "InvalidCredentials");
      assert.deepStrictEqual(refusal(failures[5]), { _tag: "TooManyAttempts", retryAfter: 900 });
    }).pipe(withLimits()),
  );

  effect(
    "refuses every sign-in from an address after 20 failures in 15 minutes, whatever the email",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        const { user } = yield* browser.signUp(asTyped("ada@example.com"));

        for (let guessed = 0; guessed < 4; guessed++) {
          yield* failSignIn(browser, `guessed-${guessed}@example.com`, 4);
        }

        yield* failSignIn(browser, "guessed-4@example.com", 3);
        // A sign-in that succeeds leaves the counter of the address as it is: 19 failures.
        assert.strictEqual((yield* browser.signIn(asTyped("ada@example.com"))).user.id, user.id);
        const twentieth = yield* failSignIn(browser, "guessed-4@example.com", 1);

        const onAnotherEmail = yield* failSignIn(browser, "guessed-5@example.com", 1);

        const withTheRightPassword = yield* browser
          .signIn(asTyped("ada@example.com"))
          .pipe(Effect.flip);

        assert.strictEqual(twentieth[0]?._tag, "InvalidCredentials");
        assert.deepStrictEqual(refusal(onAnotherEmail[0]), {
          _tag: "TooManyAttempts",
          retryAfter: 900,
        });
        assert.deepStrictEqual(refusal(withTheRightPassword), {
          _tag: "TooManyAttempts",
          retryAfter: 900,
        });

        yield* TestClock.adjust("15 minutes");
        assert.strictEqual((yield* browser.signIn(asTyped("ada@example.com"))).user.id, user.id);
      }).pipe(withLimits()),
  );

  effect("refuses a sign-up after 10 from the address in one hour, the failed ones included", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      for (let visitor = 0; visitor < 8; visitor++) {
        yield* browser.signUp(asTyped(`visitor-${visitor}@example.com`));
      }

      const taken = yield* Effect.forEach(Array.from({ length: 2 }), () =>
        Effect.flip(browser.signUp(asTyped("visitor-0@example.com"))),
      );

      yield* TestClock.adjust("20 minutes");
      const eleventh = yield* browser.signUp(asTyped("visitor-8@example.com")).pipe(Effect.flip);

      // The same answer for an email a User has: it does not say so.
      const onTakenEmail = yield* browser
        .signUp(asTyped("visitor-0@example.com"))
        .pipe(Effect.flip);

      assert.deepStrictEqual(
        taken.map((error) => error._tag),
        ["EmailAlreadyTaken", "EmailAlreadyTaken"],
      );
      assert.deepStrictEqual(refusal(eleventh), { _tag: "TooManyAttempts", retryAfter: 2400 });
      assert.deepStrictEqual(refusal(onTakenEmail), refusal(eleventh));
      yield* browser.signIn(asTyped("visitor-1@example.com"));

      yield* TestClock.adjust("40 minutes");
      const { user } = yield* browser.signUp(asTyped("visitor-8@example.com"));
      assert.strictEqual(user.email, "visitor-8@example.com");
    }).pipe(withLimits()),
  );

  effect("does not start with a limit under 1, which would refuse nothing", () =>
    Effect.gen(function* () {
      const started = yield* makeBrowser.pipe(withLimits({ SIGN_UPS_PER_IP: "0" }), Effect.exit);

      assert.isTrue(Exit.isFailure(started));
    }),
  );

  effect("takes its limits and its windows from the config", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("ada@example.com"));
      yield* browser.signUp(asTyped("grace@example.com"));

      const thirdSignUp = yield* browser.signUp(asTyped("linus@example.com")).pipe(Effect.flip);
      const signIns = yield* failSignIn(browser, "ada@example.com", 3);
      yield* failSignIn(browser, "grace@example.com", 1);
      const fromTheAddress = yield* failSignIn(browser, "linus@example.com", 1);

      assert.deepStrictEqual(refusal(thirdSignUp), { _tag: "TooManyAttempts", retryAfter: 7200 });
      assert.strictEqual(signIns[1]?._tag, "InvalidCredentials");
      assert.deepStrictEqual(refusal(signIns[2]), { _tag: "TooManyAttempts", retryAfter: 60 });
      assert.deepStrictEqual(refusal(fromTheAddress[0]), {
        _tag: "TooManyAttempts",
        retryAfter: 30,
      });
    }).pipe(
      withLimits({
        SIGN_IN_FAILURES_PER_EMAIL: "2",
        SIGN_IN_FAILURES_PER_EMAIL_WINDOW: "1 minute",
        SIGN_IN_FAILURES_PER_IP: "3",
        SIGN_IN_FAILURES_PER_IP_WINDOW: "30 seconds",
        SIGN_UPS_PER_IP: "2",
        SIGN_UPS_PER_IP_WINDOW: "2 hours",
      }),
    ),
  );
});

const newPassword = Redacted.make("a brand new password, chosen");

const realPause = Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 10)));

/**
 * The mails sent to `email`, once there are `count` of them, or after a second: the request answers before the
 * link is mailed, and the mail is rendered in real time, which the TestClock does not drive.
 */
const mailsTo = Effect.fn(function* (email: string, count: number) {
  const sent = yield* SentMails;

  for (let tries = 0; ; tries++) {
    const mails = (yield* sent.all).filter((mail) => mail.to === email);

    if (mails.length >= count || tries === 100) return mails;

    yield* realPause;
  }
});

/** The token of the `nth` Password Reset link mailed to `email`. */
const resetTokenOf = Effect.fn(function* (email: string, nth = 1) {
  const mails = yield* mailsTo(email, nth);

  const token = /https:\/\/quack\.test\/reset-password\?token=([\w-]+)/.exec(
    mails.at(-1)?.text ?? "",
  )?.[1];

  assert.isDefined(token, `no Password Reset link was mailed to ${email}`);

  return token ?? "";
});

const aUserWithStatus = (email: string, status: "invited" | "suspended") =>
  aUser({ email: asTyped(email), status });

layer(withConfig({ SIGN_UPS_PER_IP: "1000", PASSWORD_RESETS_PER_IP: "1000" }))(
  "IdentityApi, Password Reset",
  (it) => {
    it.effect(
      "answers an unknown email and a known one the same: 202, and mails only the User",
      () =>
        Effect.gen(function* () {
          const browser = yield* makeBrowser;
          yield* browser.signUp(asTyped("reset.ada@example.com"));

          const known = yield* browser.requestPasswordReset(asTyped("reset.ada@example.com"));
          const unknown = yield* browser.requestPasswordReset(asTyped("reset.nobody@example.com"));

          assert.strictEqual(known, 202);
          assert.strictEqual(unknown, 202);
          assert.lengthOf(yield* mailsTo("reset.ada@example.com", 1), 1);
          assert.lengthOf(yield* mailsTo("reset.nobody@example.com", 0), 0);
        }),
    );

    it.effect("mails a link to the web app's origin, never to the request's", () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        yield* browser.signUp(asTyped("reset.origin@example.com"));

        yield* browser.requestPasswordReset(asTyped(" Reset.Origin@Example.com "));

        const [mail] = yield* mailsTo("reset.origin@example.com", 1);
        assert.match(mail?.html ?? "", /https:\/\/quack\.test\/reset-password\?token=/);
        assert.match(mail?.text ?? "", /lasts 1 hour/);
      }),
    );

    it.effect("mails nothing to a suspended or an invited User, and answers the same", () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        yield* aUserWithStatus("reset.suspended@example.com", "suspended");
        yield* aUserWithStatus("reset.invited@example.com", "invited");
        yield* browser.signUp(asTyped("reset.active@example.com"));

        const suspended = yield* browser.requestPasswordReset(
          asTyped("reset.suspended@example.com"),
        );

        const invited = yield* browser.requestPasswordReset(asTyped("reset.invited@example.com"));
        // Asked last: once its mail is sent, the requests before it are done.
        yield* browser.requestPasswordReset(asTyped("reset.active@example.com"));
        yield* mailsTo("reset.active@example.com", 1);

        assert.deepStrictEqual([suspended, invited], [202, 202]);
        assert.lengthOf(yield* mailsTo("reset.suspended@example.com", 0), 0);
        assert.lengthOf(yield* mailsTo("reset.invited@example.com", 0), 0);
      }),
    );

    it.effect(
      "sets the new password: the User signs in with it, and no longer with the old one",
      () =>
        Effect.gen(function* () {
          const browser = yield* makeBrowser;
          yield* browser.signUp(asTyped("reset.grace@example.com"));
          yield* browser.requestPasswordReset(asTyped("reset.grace@example.com"));

          yield* browser.confirmPasswordReset(
            yield* resetTokenOf("reset.grace@example.com"),
            newPassword,
          );

          const old = yield* browser.signIn(asTyped("reset.grace@example.com")).pipe(Effect.flip);
          assert.strictEqual(old._tag, "InvalidCredentials");
          const { user } = yield* browser.signIn(asTyped("reset.grace@example.com"), newPassword);
          assert.strictEqual(user.email, "reset.grace@example.com");
        }),
    );

    it.effect("ends every Session of the User, and opens none", () =>
      Effect.gen(function* () {
        const laptop = yield* makeBrowser;
        const phone = yield* makeBrowser;
        const stranger = yield* makeBrowser;
        yield* laptop.signUp(asTyped("reset.hedy@example.com"));
        yield* phone.signIn(asTyped("reset.hedy@example.com"));
        yield* stranger.signUp(asTyped("reset.stranger@example.com"));
        yield* stranger.requestPasswordReset(asTyped("reset.hedy@example.com"));

        yield* stranger.confirmPasswordReset(
          yield* resetTokenOf("reset.hedy@example.com"),
          newPassword,
        );

        assert.strictEqual((yield* Effect.flip(laptop.me))._tag, "Unauthenticated");
        assert.strictEqual((yield* Effect.flip(phone.me))._tag, "Unauthenticated");
        assert.strictEqual((yield* stranger.me).email, "reset.stranger@example.com");
      }),
    );

    it.effect("uses a link once: a second confirm fails with ExpiredLink", () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        yield* browser.signUp(asTyped("reset.once@example.com"));
        yield* browser.requestPasswordReset(asTyped("reset.once@example.com"));
        const token = yield* resetTokenOf("reset.once@example.com");

        yield* browser.confirmPasswordReset(token, newPassword);
        const again = yield* browser.confirmPasswordReset(token, password).pipe(Effect.flip);

        assert.strictEqual(again._tag, "ExpiredLink");
        yield* browser.signIn(asTyped("reset.once@example.com"), newPassword);
      }),
    );

    it.effect("refuses a link after 1 hour, and takes it one second before", () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        yield* browser.signUp(asTyped("reset.late@example.com"));
        yield* browser.signUp(asTyped("reset.early@example.com"));
        yield* browser.requestPasswordReset(asTyped("reset.late@example.com"));
        yield* browser.requestPasswordReset(asTyped("reset.early@example.com"));

        const early = yield* resetTokenOf("reset.early@example.com");
        const lateToken = yield* resetTokenOf("reset.late@example.com");

        yield* TestClock.adjust(Duration.subtract(Duration.hours(1), Duration.seconds(1)));
        yield* browser.confirmPasswordReset(early, newPassword);
        yield* TestClock.adjust("1 second");

        const late = yield* browser.confirmPasswordReset(lateToken, newPassword).pipe(Effect.flip);

        assert.strictEqual(late._tag, "ExpiredLink");
        yield* browser.signIn(asTyped("reset.late@example.com"));
      }),
    );

    it.effect("invalidates the earlier links of the User when they ask again", () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        yield* browser.signUp(asTyped("reset.twice@example.com"));
        yield* browser.requestPasswordReset(asTyped("reset.twice@example.com"));
        const first = yield* resetTokenOf("reset.twice@example.com");

        yield* browser.requestPasswordReset(asTyped("reset.twice@example.com"));
        const second = yield* resetTokenOf("reset.twice@example.com", 2);

        assert.notStrictEqual(first, second);
        const refused = yield* browser.confirmPasswordReset(first, newPassword).pipe(Effect.flip);
        assert.strictEqual(refused._tag, "ExpiredLink");
        yield* browser.confirmPasswordReset(second, newPassword);
      }),
    );

    it.effect("fails with ExpiredLink for a token it never gave", () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;

        const error = yield* browser
          .confirmPasswordReset("not-a-token", newPassword)
          .pipe(Effect.flip);

        assert.strictEqual(error._tag, "ExpiredLink");
      }),
    );

    it.effect("fails with ExpiredLink for a User suspended after asking", () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        const { user } = yield* browser.signUp(asTyped("reset.later.suspended@example.com"));
        yield* browser.requestPasswordReset(asTyped("reset.later.suspended@example.com"));
        const token = yield* resetTokenOf("reset.later.suspended@example.com");
        yield* setStatus(user.id, "suspended");

        const error = yield* browser.confirmPasswordReset(token, newPassword).pipe(Effect.flip);

        assert.strictEqual(error._tag, "ExpiredLink");
      }),
    );
  },
);

/** The token of the `nth` Email Change link mailed to `email`. */
const emailChangeTokenOf = Effect.fn(function* (email: string, nth = 1) {
  const mails = yield* mailsTo(email, nth);

  const token = /https:\/\/quack\.test\/confirm-email\?token=([\w-]+)/.exec(
    mails.at(-1)?.text ?? "",
  )?.[1];

  assert.isDefined(token, `no Email Change link was mailed to ${email}`);

  return token ?? "";
});

layer(withConfig({ SIGN_UPS_PER_IP: "1000" }))("IdentityApi, Email Change", (it) => {
  it.effect("refuses a wrong current password, and mails nothing", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("change.wrong@example.com"));

      const error = yield* browser
        .requestEmailChange(asTyped("change.wrong.new@example.com"), newPassword)
        .pipe(Effect.flip);

      assert.strictEqual(error._tag, "WrongPassword");
      assert.isNull(yield* browser.pendingEmail);
      assert.lengthOf(yield* mailsTo("change.wrong.new@example.com", 0), 0);
      assert.lengthOf(yield* mailsTo("change.wrong@example.com", 0), 0);
    }),
  );

  // `Authentication` reads the User before the request does: a suspended User asks for nothing.
  it.effect(
    "refuses the Email Change of a User suspended since they signed in, and mails nothing",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        const { user } = yield* browser.signUp(asTyped("change.suspended@example.com"));
        yield* setStatus(user.id, "suspended");

        const error = yield* browser
          .requestEmailChange(asTyped("change.suspended.new@example.com"))
          .pipe(Effect.flip);

        assert.strictEqual(error._tag, "Unauthenticated");
        assert.lengthOf(yield* mailsTo("change.suspended.new@example.com", 0), 0);
        assert.lengthOf(yield* mailsTo("change.suspended@example.com", 0), 0);
      }),
  );

  it.effect("keeps the email until the link is opened, then changes it", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("change.ada@example.com"));

      yield* browser.requestEmailChange(asTyped(" Change.Ada.New@Example.com "));

      assert.strictEqual((yield* browser.me).email, "change.ada@example.com");
      assert.strictEqual(yield* browser.pendingEmail, "change.ada.new@example.com");
      yield* browser.signIn(asTyped("change.ada@example.com"));

      yield* browser.confirmEmailChange(yield* emailChangeTokenOf("change.ada.new@example.com"));

      assert.strictEqual((yield* browser.me).email, "change.ada.new@example.com");
      assert.isNull(yield* browser.pendingEmail);
      yield* browser.signIn(asTyped("change.ada.new@example.com"));
      const old = yield* browser.signIn(asTyped("change.ada@example.com")).pipe(Effect.flip);
      assert.strictEqual(old._tag, "InvalidCredentials");
    }),
  );

  it.effect("mails the link to the new email, and a notice to the old one", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("change.mails@example.com"));

      yield* browser.requestEmailChange(asTyped("change.mails.new@example.com"));

      const [confirmation] = yield* mailsTo("change.mails.new@example.com", 1);
      const [notice] = yield* mailsTo("change.mails@example.com", 1);
      assert.match(confirmation?.html ?? "", /https:\/\/quack\.test\/confirm-email\?token=/);
      assert.match(confirmation?.text ?? "", /lasts 24 hours/);
      assert.notMatch(notice?.text ?? "", /confirm-email/);
      assert.match(notice?.text ?? "", /c\*\*\*@example\.com/);
    }),
  );

  it.effect("keeps every Session of the User open", () =>
    Effect.gen(function* () {
      const laptop = yield* makeBrowser;
      const phone = yield* makeBrowser;
      const elsewhere = yield* makeBrowser;
      yield* laptop.signUp(asTyped("change.sessions@example.com"));
      yield* phone.signIn(asTyped("change.sessions@example.com"));
      yield* laptop.requestEmailChange(asTyped("change.sessions.new@example.com"));

      // A device with no Session confirms: the token is the proof.
      yield* elsewhere.confirmEmailChange(
        yield* emailChangeTokenOf("change.sessions.new@example.com"),
      );

      assert.strictEqual((yield* laptop.me).email, "change.sessions.new@example.com");
      assert.strictEqual((yield* phone.me).email, "change.sessions.new@example.com");
      assert.strictEqual((yield* Effect.flip(elsewhere.me))._tag, "Unauthenticated");
    }),
  );

  it.effect("uses a link once: a second confirm fails with ExpiredLink", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("change.once@example.com"));
      yield* browser.requestEmailChange(asTyped("change.once.new@example.com"));
      const token = yield* emailChangeTokenOf("change.once.new@example.com");

      yield* browser.confirmEmailChange(token);
      const again = yield* browser.confirmEmailChange(token).pipe(Effect.flip);

      assert.strictEqual(again._tag, "ExpiredLink");
    }),
  );

  it.effect("refuses a link after 24 hours, and takes it one second before", () =>
    Effect.gen(function* () {
      const early = yield* makeBrowser;
      const late = yield* makeBrowser;
      yield* early.signUp(asTyped("change.early@example.com"));
      yield* late.signUp(asTyped("change.late@example.com"));
      yield* early.requestEmailChange(asTyped("change.early.new@example.com"));
      yield* late.requestEmailChange(asTyped("change.late.new@example.com"));

      yield* TestClock.adjust(Duration.subtract(Duration.hours(24), Duration.seconds(1)));
      yield* early.confirmEmailChange(yield* emailChangeTokenOf("change.early.new@example.com"));
      yield* TestClock.adjust("1 second");

      assert.isNull(yield* late.pendingEmail);

      const error = yield* late
        .confirmEmailChange(yield* emailChangeTokenOf("change.late.new@example.com"))
        .pipe(Effect.flip);

      assert.strictEqual(error._tag, "ExpiredLink");
      assert.strictEqual((yield* late.me).email, "change.late@example.com");
    }),
  );

  it.effect("invalidates the earlier link when the User asks again", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("change.twice@example.com"));
      yield* browser.requestEmailChange(asTyped("change.twice.first@example.com"));
      const first = yield* emailChangeTokenOf("change.twice.first@example.com");

      yield* browser.requestEmailChange(asTyped("change.twice.second@example.com"));

      assert.strictEqual(yield* browser.pendingEmail, "change.twice.second@example.com");
      const refused = yield* browser.confirmEmailChange(first).pipe(Effect.flip);
      assert.strictEqual(refused._tag, "ExpiredLink");
      yield* browser.confirmEmailChange(
        yield* emailChangeTokenOf("change.twice.second@example.com"),
      );
      assert.strictEqual((yield* browser.me).email, "change.twice.second@example.com");
    }),
  );

  it.effect("cancels: the link stops working, and no email is pending", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("change.cancel@example.com"));
      yield* browser.requestEmailChange(asTyped("change.cancel.new@example.com"));

      yield* browser.cancelEmailChange;

      assert.isNull(yield* browser.pendingEmail);

      const error = yield* browser
        .confirmEmailChange(yield* emailChangeTokenOf("change.cancel.new@example.com"))
        .pipe(Effect.flip);

      assert.strictEqual(error._tag, "ExpiredLink");
      assert.strictEqual((yield* browser.me).email, "change.cancel@example.com");
    }),
  );

  it.effect("refuses an email another User has, or the User's own, when asked", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* (yield* makeBrowser).signUp(asTyped("change.taken.other@example.com"));
      yield* browser.signUp(asTyped("change.taken@example.com"));

      const other = yield* browser
        .requestEmailChange(asTyped("change.taken.other@example.com"))
        .pipe(Effect.flip);

      const own = yield* browser
        .requestEmailChange(asTyped("change.taken@example.com"))
        .pipe(Effect.flip);

      assert.deepStrictEqual([other._tag, own._tag], ["EmailAlreadyTaken", "EmailAlreadyTaken"]);
    }),
  );

  it.effect("fails the confirm when another User has taken the new email meanwhile", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("change.race@example.com"));
      yield* browser.requestEmailChange(asTyped("change.race.new@example.com"));
      const token = yield* emailChangeTokenOf("change.race.new@example.com");
      yield* (yield* makeBrowser).signUp(asTyped("change.race.new@example.com"));

      const error = yield* browser.confirmEmailChange(token).pipe(Effect.flip);

      assert.strictEqual(error._tag, "EmailAlreadyTaken");
      assert.strictEqual((yield* browser.me).email, "change.race@example.com");
      const again = yield* browser.confirmEmailChange(token).pipe(Effect.flip);
      assert.strictEqual(again._tag, "ExpiredLink");
    }),
  );

  it.effect("fails with ExpiredLink for a token it never gave, or one of a Password Reset", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("change.reset.link@example.com"));
      yield* browser.requestPasswordReset(asTyped("change.reset.link@example.com"));

      const unknown = yield* browser.confirmEmailChange("not-a-token").pipe(Effect.flip);

      const reset = yield* browser
        .confirmEmailChange(yield* resetTokenOf("change.reset.link@example.com"))
        .pipe(Effect.flip);

      assert.deepStrictEqual([unknown._tag, reset._tag], ["ExpiredLink", "ExpiredLink"]);
    }),
  );

  it.effect(
    "fails requestEmailChange and cancelEmailChange with Unauthenticated without a Session",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;

        const request = yield* browser
          .requestEmailChange(asTyped("change.nobody@example.com"))
          .pipe(Effect.flip);

        const cancel = yield* browser.cancelEmailChange.pipe(Effect.flip);

        assert.deepStrictEqual([request._tag, cancel._tag], ["Unauthenticated", "Unauthenticated"]);
      }),
  );
});

describe("IdentityApi, Email Change limits", () => {
  effect("refuses an Email Change past EMAIL_CHANGES_PER_USER, wrong passwords included", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("change.limit@example.com"));
      yield* browser
        .requestEmailChange(asTyped("change.limit.new@example.com"), newPassword)
        .pipe(Effect.flip);
      yield* browser.requestEmailChange(asTyped("change.limit.new@example.com"));

      const error = yield* browser
        .requestEmailChange(asTyped("change.limit.new@example.com"))
        .pipe(Effect.flip);

      assert.strictEqual(error._tag, "TooManyAttempts");
    }).pipe(withLimits({ EMAIL_CHANGES_PER_USER: "2" })),
  );
});

describe("IdentityApi, Password Reset limits", () => {
  effect("refuses a request past the limit on the email, known or not: TooManyAttempts", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("limit.ada@example.com"));

      const known = yield* Effect.forEach(Array.from({ length: 3 }), () =>
        browser.requestPasswordReset(asTyped("limit.ada@example.com")),
      );

      const unknown = yield* Effect.forEach(Array.from({ length: 3 }), () =>
        browser.requestPasswordReset(asTyped("limit.nobody@example.com")),
      );

      const refusedKnown = yield* browser
        .requestPasswordReset(asTyped("limit.ada@example.com"))
        .pipe(Effect.flip);

      const refusedUnknown = yield* browser
        .requestPasswordReset(asTyped("limit.nobody@example.com"))
        .pipe(Effect.flip);

      assert.deepStrictEqual([...known, ...unknown], [202, 202, 202, 202, 202, 202]);
      assert.deepStrictEqual(refusal(refusedKnown), refusal(refusedUnknown));
      assert.strictEqual(refusedKnown._tag, "TooManyAttempts");
      assert.lengthOf(yield* mailsTo("limit.ada@example.com", 3), 3);
    }).pipe(withLimits({ PASSWORD_RESETS_PER_EMAIL: "3" })),
  );
});

/** "ok" when the request succeeds, "refused" when it fails as a wrong password or a dead link does, the tag otherwise. */
const answerOf = <A, E extends { readonly _tag: string }, R>(request: Effect.Effect<A, E, R>) =>
  request.pipe(
    Effect.as("ok"),
    Effect.catch((error) =>
      Effect.succeed(
        error._tag === "InvalidCredentials" || error._tag === "ExpiredLink"
          ? "refused"
          : error._tag,
      ),
    ),
  );

const modelLimits = {
  SIGN_UPS_PER_IP: "1000",
  SIGN_IN_FAILURES_PER_EMAIL: "1000",
  SIGN_IN_FAILURES_PER_IP: "1000",
  PASSWORD_RESETS_PER_EMAIL: "1000",
  PASSWORD_RESETS_PER_IP: "1000",
  EMAIL_CHANGES_PER_USER: "1000",
};

layer(withConfig(modelLimits))("IdentityApi, a Session against its model", (it) => {
  it.effect(
    "answers every transition of the model as the model does",
    () =>
      Effect.gen(function* () {
        for (const [index, walk] of sessionModelWalks.entries()) {
          const browser = yield* makeBrowser;
          const email = asTyped(`model.session.${index}@example.com`);
          const { user } = yield* browser.signUp(email);
          yield* browser.signOut;

          let passwords: ReadonlyArray<Password> = [password];
          let links: ReadonlyArray<string> = [];
          const taken: Array<string> = [];

          const chooseWithLastLink = Effect.gen(function* () {
            const chosen = Redacted.make(`the password chosen with link ${links.length}`);
            yield* browser.confirmPasswordReset(links.at(-1) ?? "", chosen);
            passwords = [...passwords, chosen];
          });

          // A request that mails nothing waits out the second `mailsTo` gives a mail to arrive.
          const requestLink = Effect.gen(function* () {
            yield* browser.requestPasswordReset(email);
            const mailed = (yield* mailsTo(email, links.length + 1)).length > links.length;

            if (mailed) links = [...links, yield* resetTokenOf(email, links.length + 1)];

            return mailed ? "mailed" : "notMailed";
          });

          const steps = {
            signIn: () => answerOf(browser.signIn(email, passwords.at(-1))),
            signInWithFormerPassword: () => answerOf(browser.signIn(email, passwords.at(-2))),
            signOut: () => answerOf(browser.signOut),
            suspend: () => answerOf(setStatus(user.id, "suspended")),
            reactivate: () => answerOf(setStatus(user.id, "active")),
            requestReset: () => requestLink,
            confirmReset: () => answerOf(chooseWithLastLink),
            confirmReplacedLink: () =>
              answerOf(
                browser.confirmPasswordReset(
                  links.at(-2) ?? "",
                  Redacted.make("a password no link may set"),
                ),
              ),
            waitAnHour: () => answerOf(TestClock.adjust("1 hour")),
          };

          for (const { event, state } of walk) {
            taken.push(event.type);
            const answer = yield* steps[event.type]();

            assert.deepStrictEqual(
              { answer, signedIn: Exit.isSuccess(yield* Effect.exit(browser.me)) },
              { answer: state.context.answer, signedIn: state.value === "signedIn" },
              taken.join(" → "),
            );
          }
        }
      }),
    // Past the default 5 seconds: one argon2 hash or more for most steps, and the waits for mails never sent.
    60_000,
  );
});

layer(withConfig(modelLimits))("IdentityApi, an Email Change against its model", (it) => {
  it.effect(
    "answers every transition of the model as the model does",
    () =>
      Effect.gen(function* () {
        for (const [index, walk] of emailChangeModelWalks.entries()) {
          const browser = yield* makeBrowser;
          const otherEmail = asTyped(`model.change.${index}.other@example.com`);
          yield* (yield* makeBrowser).signUp(otherEmail);

          let emails: ReadonlyArray<Email> = [asTyped(`model.change.${index}@example.com`)];
          yield* browser.signUp(emails[0] ?? otherEmail);

          let newEmails: ReadonlyArray<Email> = [];
          let links: ReadonlyArray<string> = [];
          const taken: Array<string> = [];

          const request = Effect.gen(function* () {
            const newEmail = asTyped(`model.change.${index}.new.${newEmails.length}@example.com`);
            yield* browser.requestEmailChange(newEmail);
            newEmails = [...newEmails, newEmail];
            links = [...links, yield* emailChangeTokenOf(newEmail)];
          });

          const confirm = Effect.gen(function* () {
            yield* browser.confirmEmailChange(links.at(-1) ?? "");
            emails = [...emails, newEmails.at(-1) ?? otherEmail];
          });

          const steps = {
            request: () => answerOf(request),
            requestWithWrongPassword: () =>
              answerOf(
                browser.requestEmailChange(
                  asTyped(`model.change.${index}.refused@example.com`),
                  wrongPassword,
                ),
              ),
            requestTakenEmail: () => answerOf(browser.requestEmailChange(otherEmail)),
            cancel: () => answerOf(browser.cancelEmailChange),
            confirm: () => answerOf(confirm),
            confirmReplacedLink: () => answerOf(browser.confirmEmailChange(links.at(-2) ?? "")),
            takeNewEmail: () =>
              answerOf(
                Effect.flatMap(makeBrowser, (other) =>
                  other.signUp(newEmails.at(-1) ?? otherEmail),
                ),
              ),
            waitADay: () => answerOf(TestClock.adjust("24 hours")),
            signIn: () => answerOf(browser.signIn(emails.at(-1) ?? otherEmail)),
            signInWithFormerEmail: () => answerOf(browser.signIn(emails.at(-2) ?? otherEmail)),
          };

          for (const { event, state } of walk) {
            taken.push(event.type);
            const answer = yield* steps[event.type]();

            assert.deepStrictEqual(
              {
                answer,
                email: (yield* browser.me).email,
                pendingEmail: yield* browser.pendingEmail,
              },
              {
                answer: state.context.answer,
                email: emails.at(-1),
                pendingEmail: state.value === "pending" ? newEmails.at(-1) : null,
              },
              taken.join(" → "),
            );
          }
        }
      }),
    // Past the default 5 seconds: an argon2 hash or more for most steps.
    60_000,
  );
});
