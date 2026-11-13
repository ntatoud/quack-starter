import { Api } from "@quack/contracts/api";
import { CurrentUser, sessionCookie } from "@quack/contracts/identity/authentication";
import { DateTime, Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Identity, type OpenedSession } from "#/modules/identity/application/identity.ts";

/**
 * Hands the Session to the browser, which sends it back on every request to this origin.
 * - `HttpOnly`: the page's JavaScript cannot read it.
 * - `SameSite=Lax`: another site cannot make a request that changes state carry it.
 * - No `Domain`: the cookie stays on the host that set it.
 * - `Max-Age`: the browser drops it when the Session expires.
 */
const setSessionCookie = Effect.fn("IdentityHandlers.setSessionCookie")(function* (
  session: OpenedSession,
) {
  yield* HttpApiBuilder.securitySetCookie(sessionCookie, session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DateTime.distance(yield* DateTime.now, session.expiresAt),
  });
});

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
      me: () => Effect.service(CurrentUser),
    });
  }),
);
