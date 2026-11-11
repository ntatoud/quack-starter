import { Authentication, CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect, Layer, Option } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";

/**
 * The server side of the contract's `Authentication`: the session cookie becomes the `CurrentUser`.
 * A request with no cookie arrives here with an empty credential, which opens no Session.
 * A request it refuses, with no Session, one the server does not know, or one that has expired, has its cookie cleared.
 */
export const AuthenticationMiddleware = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const identity = yield* Identity;
    const cookie = yield* SessionCookie;

    return Authentication.of({
      session: Effect.fn(function* (httpEffect, { credential }) {
        const { user, renewed } = yield* identity.authenticate(credential).pipe(
          // A cookie that opens no Session is of no use to the browser: it drops it.
          Effect.tapError(() => cookie.clear),
        );
        // The Session lasts longer: so does its cookie.
        if (Option.isSome(renewed)) {
          yield* cookie.set(renewed.value);
        }
        return yield* Effect.provideService(httpEffect, CurrentUser, user);
      }),
    });
  }),
);
