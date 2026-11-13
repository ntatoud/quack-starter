import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import type { Email, Password } from "@quack/contracts/identity/user";
import { Duration, Effect, Layer, Option, Redacted, Ref } from "effect";
import { Cookies, HttpClientRequest, type HttpClientResponse, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";

import { IdentityModule } from "#/modules/identity/index.ts";

const password = Redacted.make("correct horse battery staple");

/** What a client that does not normalize the email sends: the text as the visitor typed it. */
const asTyped = (email: string) => email as Email;

/**
 * A client with a cookie jar, as a browser has one: it keeps the cookies of a sign-up,
 * and sends them to the endpoints that `Authentication` protects.
 */
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

  /** Keeps the cookies of a response, as a browser does: one that comes with `Max-Age=0` is dropped. */
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
    /** The value of the session cookie in the jar. */
    session: Effect.map(Ref.get(jar), (cookies) => Cookies.getValue(cookies, "session")),
    me: client.identity.me(),
    /** Puts a cookie in the jar, as a visitor who edits their cookies would. */
    setCookie: (name: string, value: string) => Ref.update(jar, Cookies.setUnsafe(name, value)),
  };
});

layer(Layer.mergeAll(IdentityModule, HttpServer.layerServices))("IdentityApi", (it) => {
  it.effect("signs a visitor up, and answers with their public User", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;

      const { user } = yield* browser.signUp(asTyped("ada@example.com"));

      assert.strictEqual(user.email, "ada@example.com");
      assert.isAbove(user.id.length, 0);
      assert.deepStrictEqual(Object.keys(user).toSorted(), ["email", "id"]);
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

        assert.deepStrictEqual(signedIn.user, user);
        assert.deepStrictEqual(Object.keys(signedIn.user).toSorted(), ["email", "id"]);
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
        "Max-Age=2592000",
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
      assert.match(setCookie[0] ?? "", /^session=; .*Max-Age=0/);
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

  it.effect("fails me with Unauthenticated once the Session has expired, 30 days later", () =>
    Effect.gen(function* () {
      const browser = yield* makeBrowser;
      const { user } = yield* browser.signUp(asTyped("katherine@example.com"));

      yield* TestClock.adjust("29 days");
      assert.deepStrictEqual(yield* browser.me, user);

      yield* TestClock.adjust("1 day");
      const error = yield* browser.me.pipe(Effect.flip);
      assert.strictEqual(error._tag, "Unauthenticated");
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
        // 30 days are 2 592 000 seconds.
        assert.deepStrictEqual(attributes.toSorted(), [
          "HttpOnly",
          "Max-Age=2592000",
          "Path=/",
          "SameSite=Lax",
          "Secure",
        ]);
      }),
  );
});
