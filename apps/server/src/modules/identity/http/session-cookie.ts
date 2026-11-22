import { sessionCookie } from "@quack/contracts/identity/authentication";
import { Context, DateTime, Effect, Layer } from "effect";
import { HttpEffect, type HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { ServerConfig } from "#/config.ts";
import type { OpenedSession } from "#/modules/identity/application/identity.ts";

/** @effect-expect-leaking HttpServerRequest */
export class SessionCookie extends Context.Service<
  SessionCookie,
  {
    set(session: OpenedSession): Effect.Effect<void, never, HttpServerRequest.HttpServerRequest>;
    readonly clear: Effect.Effect<void, never, HttpServerRequest.HttpServerRequest>;
  }
>()("@quack/server/identity/SessionCookie") {
  static readonly layer = Layer.effect(
    SessionCookie,
    Effect.gen(function* () {
      const cookieSecure = yield* ServerConfig.cookieSecure;

      // Clearing takes the same attributes, or the browser keeps the cookie it has.
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
