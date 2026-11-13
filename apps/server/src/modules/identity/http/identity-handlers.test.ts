import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import type { Email } from "@quack/contracts/identity/user";
import { Effect, Layer, Redacted, Ref } from "effect";
import { Cookies, HttpClientRequest, HttpServer } from "effect/http";
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

  const signUp = Effect.fn(function* (email: Email) {
    const [user, response] = yield* client.identity.signUp({
      payload: { email, password },
      responseMode: "decoded-and-response",
    });
    yield* Ref.update(jar, Cookies.merge(response.cookies));
    return { user, setCookie: Cookies.toSetCookieHeaders(response.cookies) };
  });

  return {
    signUp,
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
