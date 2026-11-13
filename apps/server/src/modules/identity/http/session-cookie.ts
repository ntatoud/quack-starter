import { sessionCookie } from "@quack/contracts/identity/authentication";
import { Context, DateTime, Effect, Layer } from "effect";
import { HttpEffect, type HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { ServerConfig } from "#/config.ts";
import type { OpenedSession } from "#/modules/identity/application/identity.ts";

/**
 * Writes the session cookie on the response of the request being handled.
 *
 * @effect-expect-leaking HttpServerRequest
 */
export class SessionCookie extends Context.Service<
  SessionCookie,
  {
    /**
     * Hands the Session to the browser, which sends it back on every request to this origin.
     * `Max-Age`: the browser drops the cookie when the Session expires.
     */
    set(session: OpenedSession): Effect.Effect<void, never, HttpServerRequest.HttpServerRequest>;
    /** Tells the browser to drop the session cookie: an empty value, `Max-Age=0`, and an `Expires` in the past. */
    readonly clear: Effect.Effect<void, never, HttpServerRequest.HttpServerRequest>;
  }
>()("@quack/server/identity/SessionCookie") {
  static readonly layer = Layer.effect(
    SessionCookie,
    Effect.gen(function* () {
      const { cookieSecure } = yield* ServerConfig;

      /**
       * The attributes of the session cookie. Clearing it takes the same ones, or the browser keeps the cookie it has.
       * - `HttpOnly`: the page's JavaScript cannot read it.
       * - `Secure`: sent over https only, unless `COOKIE_SECURE` is false.
       * - `SameSite=Lax`: another site cannot make a request that changes state carry it.
       * - No `Domain`: the cookie stays on the host that set it.
       */
      const attributes = {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: "lax",
        path: "/",
      } as const;

      return SessionCookie.of({
        set: Effect.fn("SessionCookie.set")(function* (session) {
          yield* HttpApiBuilder.securitySetCookie(sessionCookie, session.token, {
            ...attributes,
            maxAge: DateTime.distance(yield* DateTime.now, session.expiresAt),
          });
        }),
        clear: HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.orDie(HttpServerResponse.expireCookie(response, sessionCookie.key, attributes)),
        ),
      });
    }),
  );
}
