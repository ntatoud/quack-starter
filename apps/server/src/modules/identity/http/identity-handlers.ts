import { Api } from "@quack/contracts/api";
import { CurrentUser, sessionCookie } from "@quack/contracts/identity/authentication";
import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { Identity } from "#/modules/identity/application/identity.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";

/**
 * The address of the client, for the limits by address: what the web app's relay wrote in `X-Forwarded-For`.
 * It is read as it comes, since the server is reached through the relay only, which replaces what the client sent.
 * The requests that name no address share one counter.
 */
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
