import { Api } from "@quack/contracts/api";
import { CurrentUser, sessionCookie } from "@quack/contracts/identity/authentication";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Identity } from "#/modules/identity/application/identity.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";

export const IdentityHandlers = HttpApiBuilder.group(
  Api,
  "identity",
  Effect.fn(function* (handlers) {
    const identity = yield* Identity;
    const cookie = yield* SessionCookie;

    return handlers.handleAll({
      signUp: Effect.fn(function* ({ payload }) {
        const { user, session } = yield* identity.signUp(payload.email, payload.password);
        yield* cookie.set(session);
        return user;
      }),
      signIn: Effect.fn(function* ({ payload }) {
        const { user, session } = yield* identity.signIn(payload.email, payload.password);
        yield* cookie.set(session);
        return user;
      }),
      // Reads the cookie itself: the endpoint is not behind `Authentication`, which would refuse a request with no Session.
      // A request with no cookie has an empty credential, which opens no Session.
      signOut: Effect.fn(function* () {
        yield* identity.signOut(yield* HttpApiBuilder.securityDecode(sessionCookie));
        yield* cookie.clear;
      }),
      me: () => Effect.service(CurrentUser),
    });
  }),
);
