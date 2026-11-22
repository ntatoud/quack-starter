import { Api } from "@quack/contracts/api";
import { CurrentUser, sessionCookie } from "@quack/contracts/identity/authentication";
import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { Identity } from "#/modules/identity/application/identity.ts";
import { Onboarding } from "#/modules/identity/application/onboarding.ts";
import { Users } from "#/modules/identity/application/users.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";

/** Trusted as is: the server is reached through the relay only, which replaces what the client sent. */
const clientIp = Effect.map(
  HttpServerRequest.HttpServerRequest,
  (request) => request.headers["x-forwarded-for"]?.trim() || "unknown",
);

export const IdentityHandlers = HttpApiBuilder.group(
  Api,
  "identity",
  Effect.fn(function* (handlers) {
    const identity = yield* Identity;
    const cookie = yield* SessionCookie;
    const users = yield* Users;
    const onboarding = yield* Onboarding;

    return handlers.handleAll({
      signUp: Effect.fn(function* ({ payload }) {
        const { user, session } = yield* identity.signUp(
          payload.email,
          payload.password,
          yield* clientIp,
        );

        yield* cookie.set(session);

        return user;
      }),
      signIn: Effect.fn(function* ({ payload }) {
        const { user, session } = yield* identity.signIn(
          payload.email,
          payload.password,
          yield* clientIp,
        );

        yield* cookie.set(session);

        return user;
      }),
      // Not behind `Authentication`, which would refuse a request with no Session.
      signOut: Effect.fn(function* () {
        yield* identity.signOut(yield* HttpApiBuilder.securityDecode(sessionCookie));
        yield* cookie.clear;
      }),
      me: () => Effect.service(CurrentUser),
      updateProfile: Effect.fn(function* ({ payload }) {
        const currentUser = yield* CurrentUser;

        return yield* users.updateProfile(currentUser.id, payload);
      }),
      completeOnboarding: Effect.fn(function* ({ payload }) {
        const currentUser = yield* CurrentUser;

        return yield* onboarding.complete(currentUser.id, payload);
      }),
    });
  }),
);
