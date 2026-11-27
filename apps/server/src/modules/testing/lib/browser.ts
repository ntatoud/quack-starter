import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import type { OnboardingPayload } from "@quack/contracts/identity/identity-api";
import type { Profile } from "@quack/contracts/identity/profile";
import { type Email, type Password, TimeZone, User } from "@quack/contracts/identity/user";
import { Duration, Effect, Ref, Schema } from "effect";
import { Cookies, HttpClientRequest, type HttpClientResponse } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";

import { knownPassword as password } from "#/modules/testing/lib/users.ts";

const paris = Schema.decodeSync(TimeZone)("Europe/Paris");

/**
 * A browser on the identity endpoints: it keeps the cookies each answer sets, and sends them back. It signs up and
 * signs in with `knownPassword` unless told otherwise.
 */
export const makeBrowser = Effect.gen(function* () {
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

  const signUp = Effect.fn(function* (email: Email, timeZone: TimeZone = paris) {
    const [user, response] = yield* client.identity.signUp({
      payload: { email, password, timeZone },
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
    // The User alone, as the other endpoints answer it: `pendingEmail` reads the rest.
    me: Effect.map(client.identity.me(), ({ pendingEmail: _, ...user }) => new User(user)),
    pendingEmail: Effect.map(client.identity.me(), (me) => me.pendingEmail),
    updateProfile: (profile: Profile) => client.identity.updateProfile({ payload: profile }),
    updateTimeZone: (timeZone: TimeZone) =>
      client.identity.updateTimeZone({ payload: { timeZone } }),
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
    requestEmailChange: (newEmail: Email, withPassword: Password = password) =>
      client.identity.requestEmailChange({ payload: { newEmail, password: withPassword } }),
    cancelEmailChange: client.identity.cancelEmailChange(),
    confirmEmailChange: (token: string) =>
      client.identity.confirmEmailChange({ payload: { token } }),
  };
});
