import { assert, describe, effect, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { OnboardingPayload } from "@quack/contracts/identity/identity-api";
import { CountryCode, Profile } from "@quack/contracts/identity/profile";
import { type Email, type Password, User } from "@quack/contracts/identity/user";
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
  Ref,
  Schema,
} from "effect";
import { Cookies, HttpClientRequest, type HttpClientResponse, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";

import { sessionExtensionThreshold, sessionLifetime } from "#/modules/identity/domain/session.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { IdentityModule } from "#/modules/identity/index.ts";
import { LinkTokenStoreMemory } from "#/modules/identity/testing/link-token-store-memory.ts";
import { sessionModelWalks } from "#/modules/identity/testing/session-model.ts";
import { TransactionMemory } from "#/modules/transaction/testing/transaction-memory.ts";
import { SessionStoreMemory } from "#/modules/identity/testing/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";
import { MailerMemory, SentMails } from "#/modules/mail/testing/mailer-memory.ts";

const maxAge = Duration.toSeconds(sessionLifetime);

const password = Redacted.make("correct horse battery staple");

const nameOfAda = Schema.decodeSync(OnboardingPayload)({
  firstName: " Ada ",
  lastName: "Lovelace",
});

/** The email as typed, not normalized: the server must normalize it. */
const asTyped = (email: string) => email as Email;

const makeBrowser = Effect.gen(function* () {
  const jar = yield* Ref.make(Cookies.empty);

  const client = yield* HttpApiTest.groups(Api, ["identity"]).pipe(
    Effect.provide(
      HttpApiMiddleware.layerClient(
        Authentication,
        Effect.fn(function* ({ next, request }) {
          const cookies = yield* Ref.get(jar);

          return yield* next(
            Cookies.isEmpty(cookies)
              ? request
              : HttpClientRequest.setHeader(request, "cookie", Cookies.toCookieHeader(cookies)),
          );
        }),
      ),
    ),
  );

  const keepCookies = Effect.fn(function* (response: HttpClientResponse.HttpClientResponse) {
    yield* Ref.update(jar, (cookies) =>
      Cookies.fromIterable(
        Object.values(Cookies.merge(cookies, response.cookies).cookies).filter(
          (cookie) =>
            cookie.options?.maxAge === undefined ||
            Duration.isGreaterThan(Duration.fromInputUnsafe(cookie.options.maxAge), Duration.zero),
        ),
      ),
    );

    return Cookies.toSetCookieHeaders(response.cookies);
  });

  const signUp = Effect.fn(function* (email: Email) {
    const [user, response] = yield* client.identity.signUp({
      payload: { email, password },
      responseMode: "decoded-and-response",
    });

    return { user, setCookie: yield* keepCookies(response) };
  });

  const signIn = Effect.fn(function* (email: Email, withPassword: Password = password) {
    const [user, response] = yield* client.identity.signIn({
      payload: { email, password: withPassword },
      responseMode: "decoded-and-response",
    });

    return { user, setCookie: yield* keepCookies(response) };
  });

  const signOut = Effect.gen(function* () {
    const response = yield* client.identity.signOut({ responseMode: "response-only" });

    return { status: response.status, setCookie: yield* keepCookies(response) };
  });

  return {
    signUp,
    signIn,
    signOut,
    session: Effect.map(Ref.get(jar), (cookies) => Cookies.getValue(cookies, "session")),
    me: client.identity.me(),
    updateProfile: (profile: Profile) => client.identity.updateProfile({ payload: profile }),
    completeOnboarding: (payload: OnboardingPayload) =>
      client.identity.completeOnboarding({ payload }),
    meResponse: Effect.gen(function* () {
      const response = yield* client.identity.me({ responseMode: "response-only" });

      return { status: response.status, setCookie: yield* keepCookies(response) };
    }),
    setCookie: (name: string, value: string) => Ref.update(jar, Cookies.setUnsafe(name, value)),
    requestPasswordReset: (email: Email) =>
      Effect.map(
        client.identity.requestPasswordReset({
          payload: { email },
          responseMode: "decoded-and-response",
        }),
        ([, response]) => response.status,
      ),
    confirmPasswordReset: (token: string, newPassword: Password) =>
      client.identity.confirmPasswordReset({ payload: { token, password: newPassword } }),
  };
});

const aProfile = (firstName: string) =>
  new Profile({
    firstName,
    lastName: "Lovelace",
    avatarUrl: null,
    jobTitle: "Analyst",
    team: "engineering",
    country: CountryCode.make("GB"),
  });

const assertCookieCleared = (setCookie: ReadonlyArray<string>) => {
  assert.lengthOf(setCookie, 1);
  assert.match(setCookie[0] ?? "", /^session=; .*Max-Age=0/);
};

const withConfig = (env: Record<string, string>) =>
  IdentityModule.pipe(
    Layer.provide([SessionStoreMemory, LinkTokenStoreMemory, TransactionMemory]),
    // Visible, to add Users of every Status and to read the mails sent.
    Layer.provideMerge([UserRepositoryMemory, MailerMemory]),
    Layer.provideMerge(HttpServer.layerServices),
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
      ]);
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

  it.effect(
    "completes the onboarding: the name makes the Profile, nothing else filled in, and the date is set",
    () =>
      Effect.gen(function* () {
        const browser = yield* makeBrowser;
        const { user } = yield* browser.signUp(asTyped("ada.onboarding@example.com"));
        const now = yield* DateTime.now;

        const onboarded = yield* browser.completeOnboarding(nameOfAda);

        assert.deepStrictEqual(
          onboarded,
          new User({
            ...user,
            onboardedAt: now,
            profile: new Profile({
              firstName: "Ada",
              lastName: "Lovelace",
              jobTitle: "",
              team: null,
              country: null,
              avatarUrl: null,
            }),
          }),
        );
        assert.deepStrictEqual(yield* browser.me, onboarded);
      }),
  );

  it.effect("completes the onboarding again: changes the name, keeps the first date", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("ada.twice@example.com"));
      const first = yield* browser.completeOnboarding(nameOfAda);
      yield* TestClock.adjust("1 hour");

      const again = yield* browser.completeOnboarding({ ...nameOfAda, lastName: "Byron" });

      assert.strictEqual(again.profile?.lastName, "Byron");
      assert.deepStrictEqual(again.onboardedAt, first.onboardedAt);
    }),
  );

  it.effect("fails completeOnboarding with Unauthenticated without a Session", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const error = yield* browser.completeOnboarding(nameOfAda).pipe(Effect.flip);

      assert.strictEqual(error._tag, "Unauthenticated");
    }),
  );

  it.effect("fails me with Unauthenticated without a Session", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const error = yield* browser.me.pipe(Effect.flip);

      assert.strictEqual(error._tag, "Unauthenticated");
    }),
  );

  it.effect("updates the Profile of the Current User: me answers with it from then on", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      const { user } = yield* browser.signUp(asTyped("augusta@example.com"));

      const updated = yield* browser.updateProfile(aProfile("Ada"));

      assert.deepStrictEqual(updated, new User({ ...user, profile: aProfile("Ada") }));
      assert.deepStrictEqual(yield* browser.me, updated);
    }),
  );

  it.effect("replaces the whole Profile at each update", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      yield* browser.signUp(asTyped("byron@example.com"));
      yield* browser.updateProfile(aProfile("Ada"));

      yield* browser.updateProfile(
        new Profile({ ...aProfile("Augusta"), team: null, country: null }),
      );

      assert.deepStrictEqual(
        (yield* browser.me).profile,
        new Profile({ ...aProfile("Augusta"), team: null, country: null }),
      );
    }),
  );

  it.effect("updates the Profile of the Current User only", () =>
    Effect.gen(function* () {
      const ada = yield* makeBrowser;
      const charles = yield* makeBrowser;
      yield* ada.signUp(asTyped("ada.king@example.com"));
      yield* charles.signUp(asTyped("charles@example.com"));

      yield* ada.updateProfile(aProfile("Ada"));

      assert.isNull((yield* charles.me).profile);
    }),
  );

  it.effect("fails updateProfile with Unauthenticated without a Session", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const error = yield* browser.updateProfile(aProfile("Ada")).pipe(Effect.flip);

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

const aUserWithStatus = Effect.fn(function* (email: string, status: "invited" | "suspended") {
  const users = yield* UserRepository;

  yield* users.create(
    new User({
      id: yield* users.nextId,
      email: asTyped(email),
      role: "user",
      status,
      createdAt: yield* DateTime.now,
      lastSignInAt: null,
      onboardedAt: null,
      profile: null,
    }),
    "not a hash",
  );
});

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

        yield* TestClock.adjust(Duration.subtract(Duration.hours(1), Duration.seconds(1)));
        yield* browser.confirmPasswordReset(
          yield* resetTokenOf("reset.early@example.com"),
          newPassword,
        );
        yield* TestClock.adjust("1 second");

        const late = yield* browser
          .confirmPasswordReset(yield* resetTokenOf("reset.late@example.com"), newPassword)
          .pipe(Effect.flip);

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
        yield* (yield* UserRepository).update(new User({ ...user, status: "suspended" }));

        const error = yield* browser.confirmPasswordReset(token, newPassword).pipe(Effect.flip);

        assert.strictEqual(error._tag, "ExpiredLink");
      }),
    );
  },
);

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
};

layer(withConfig(modelLimits))("IdentityApi, a Session against its model", (it) => {
  it.effect(
    "answers every transition of the model as the model does",
    () =>
      Effect.gen(function* () {
        const users = yield* UserRepository;

        for (const [index, walk] of sessionModelWalks.entries()) {
          const browser = yield* makeBrowser;
          const email = asTyped(`model.session.${index}@example.com`);
          const { user } = yield* browser.signUp(email);
          yield* browser.signOut;

          let passwords: ReadonlyArray<Password> = [password];
          let links: ReadonlyArray<string> = [];
          const taken: Array<string> = [];

          const setStatus = (status: "active" | "suspended") =>
            Effect.gen(function* () {
              const found = yield* users.findById(user.id);
              yield* users.update(new User({ ...Option.getOrThrow(found), status }));
            });

          const chooseWithLastLink = Effect.gen(function* () {
            const chosen = Redacted.make(`the password chosen with link ${links.length}`);
            yield* browser.confirmPasswordReset(links.at(-1) ?? "forged", chosen);
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
            signInWithWrongPassword: () =>
              answerOf(
                browser.signIn(email, passwords.at(-2) ?? Redacted.make("never anyone's password")),
              ),
            signOut: () => answerOf(browser.signOut),
            suspend: () => answerOf(setStatus("suspended")),
            reactivate: () => answerOf(setStatus("active")),
            requestReset: () => requestLink,
            confirmReset: () => answerOf(chooseWithLastLink),
            confirmUnknownLink: () =>
              answerOf(
                browser.confirmPasswordReset(
                  links.at(-2) ?? "forged",
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
