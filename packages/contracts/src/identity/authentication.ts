import { Context } from "effect";
import { HttpApiMiddleware, HttpApiSchema, HttpApiSecurity } from "effect/http-api";

import { Unauthenticated } from "#/identity/identity-errors.ts";
import type { User } from "#/identity/user.ts";

export class CurrentUser extends Context.Service<CurrentUser, User>()(
  "@quack/contracts/identity/CurrentUser",
) {}

export const sessionCookie = HttpApiSecurity.apiKey({ key: "session", in: "cookie" });

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()("@quack/contracts/identity/Authentication", {
  security: { session: sessionCookie },
  error: Unauthenticated.pipe(HttpApiSchema.status(401)),
}) {}
