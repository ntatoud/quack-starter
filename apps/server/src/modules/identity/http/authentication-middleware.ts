import { Authentication, CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect, Layer, Option } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";

export const AuthenticationMiddleware = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const identity = yield* Identity;
    const cookie = yield* SessionCookie;

    return Authentication.of({
      session: Effect.fn(function* (httpEffect, { credential }) {
        const { user, extendedUntil } = yield* identity
          .authenticate(credential)
          .pipe(Effect.tapError(() => cookie.clear));
        if (Option.isSome(extendedUntil)) {
          yield* cookie.set({ token: credential, expiresAt: extendedUntil.value });
        }
        return yield* Effect.provideService(httpEffect, CurrentUser, user);
      }),
    });
  }),
);
