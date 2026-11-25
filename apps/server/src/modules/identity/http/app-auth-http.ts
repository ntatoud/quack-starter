import { Http } from "@yielded/auth";
import { Effect, type Layer } from "effect";

import { ServerConfig } from "#/config.ts";
import { AppAuth } from "#/modules/identity/domain/app-auth.ts";

/** Yielded refuses a cookie that is not `Secure` on an https origin, and a `__Host-` one without it. */
const isSecure = (origin: string) => origin.startsWith("https:");

/** The cookie the Session travels in, `HttpOnly`: only Yielded writes it. */
export const sessionCookieName = Effect.map(ServerConfig.publicOrigin, (origin) =>
  isSecure(origin) ? "__Host-quack-session" : "quack-session",
);

/**
 * Yielded's request boundary: it reads the Session cookie of each request, writes the ones its answer sets, and
 * refuses a sign-up, sign-in, or sign-out whose `Origin` is not Quack's or that lacks its CSRF header
 * (`x-effect-auth-csrf: 1`). Requires `AppAuth`.
 */
export const withAppAuthRequests = <A, E, R>(routes: Layer.Layer<A, E, R>) =>
  Effect.gen(function* () {
    const origin = yield* ServerConfig.publicOrigin;

    const http = Http.make(AppAuth, {
      origin,
      cookie: { name: yield* sessionCookieName, secure: isSecure(origin) },
    });

    return routes.pipe(http.middleware);
  });
