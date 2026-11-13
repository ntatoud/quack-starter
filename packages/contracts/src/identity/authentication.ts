import { Context } from "effect";
import { HttpApiMiddleware, HttpApiSchema, HttpApiSecurity } from "effect/http-api";

import { Unauthenticated } from "#/identity/identity-errors.ts";
import type { User } from "#/identity/user.ts";

/** The User whose Session made the request being handled. */
export class CurrentUser extends Context.Service<CurrentUser, User>()(
  "@quack/contracts/identity/CurrentUser",
) {}

/** Where the Session travels: the `session` cookie. */
export const sessionCookie = HttpApiSecurity.apiKey({ key: "session", in: "cookie" });

/**
 * Protects an endpoint or a group: its handlers read `CurrentUser`, and its client gets `Unauthenticated`.
 * The client needs no implementation: the browser sends the cookie.
 *
 * Attach it after the endpoints it protects: `.middleware` only covers what was added before it.
 */
export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()("@quack/contracts/identity/Authentication", {
  security: { session: sessionCookie },
  error: Unauthenticated.pipe(HttpApiSchema.status(401)),
}) {}
