import { Authentication, CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect, Layer } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";

/**
 * The server side of the contract's `Authentication`: the session cookie becomes the `CurrentUser`.
 * A request with no cookie arrives here with an empty credential, which opens no Session.
 */
export const AuthenticationMiddleware = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const identity = yield* Identity;

    return Authentication.of({
      session: Effect.fn(function* (httpEffect, { credential }) {
        const user = yield* identity.authenticate(credential);
        return yield* Effect.provideService(httpEffect, CurrentUser, user);
      }),
    });
  }),
);
