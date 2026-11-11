import { Api } from "@quack/contracts/api";
import { CurrentUser, sessionCookie } from "@quack/contracts/identity/authentication";
import { DateTime, Effect } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { Identity, type OpenedSession } from "#/modules/identity/application/identity.ts";

/**
 * The attributes of the session cookie. Clearing it takes the same ones, or the browser keeps the cookie it has.
 * - `HttpOnly`: the page's JavaScript cannot read it.
 * - `SameSite=Lax`: another site cannot make a request that changes state carry it.
 * - No `Domain`: the cookie stays on the host that set it.
 */
const sessionCookieAttributes = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
} as const;

/**
 * Hands the Session to the browser, which sends it back on every request to this origin.
 * `Max-Age`: the browser drops the cookie when the Session expires.
 */
const setSessionCookie = Effect.fn("IdentityHandlers.setSessionCookie")(function* (
  session: OpenedSession,
) {
  yield* HttpApiBuilder.securitySetCookie(sessionCookie, session.token, {
    ...sessionCookieAttributes,
    maxAge: DateTime.distance(yield* DateTime.now, session.expiresAt),
  });
});

/** Tells the browser to drop the session cookie: an empty value, `Max-Age=0`, and an `Expires` in the past. */
const clearSessionCookie = HttpEffect.appendPreResponseHandler((_request, response) =>
  Effect.orDie(
    HttpServerResponse.expireCookie(response, sessionCookie.key, sessionCookieAttributes),
  ),
);

export const IdentityHandlers = HttpApiBuilder.group(
  Api,
  "identity",
  Effect.fn(function* (handlers) {
    const identity = yield* Identity;

    return handlers.handleAll({
      signUp: Effect.fn(function* ({ payload }) {
        const { user, session } = yield* identity.signUp(payload.email, payload.password);
        yield* setSessionCookie(session);
        return user;
      }),
      signIn: Effect.fn(function* ({ payload }) {
        const { user, session } = yield* identity.signIn(payload.email, payload.password);
        yield* setSessionCookie(session);
        return user;
      }),
      // Reads the cookie itself: the endpoint is not behind `Authentication`, which would refuse a request with no Session.
      // A request with no cookie has an empty credential, which opens no Session.
      signOut: Effect.fn(function* () {
        yield* identity.signOut(yield* HttpApiBuilder.securityDecode(sessionCookie));
        yield* clearSessionCookie;
      }),
      me: () => Effect.service(CurrentUser),
    });
  }),
);
