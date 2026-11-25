import { Context } from "effect";
import { HttpApiMiddleware, HttpApiSchema } from "effect/http-api";

import { Forbidden, Unauthenticated } from "#/identity/identity-errors.ts";
import type { User } from "#/identity/user.ts";

export class CurrentUser extends Context.Service<CurrentUser, User>()(
  "@quack/contracts/identity/CurrentUser",
) {}

/** The Session travels in a cookie that the server's auth library names and reads, so the contract declares none. */
export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()("@quack/contracts/identity/Authentication", {
  error: [
    Unauthenticated.pipe(HttpApiSchema.status(401)),
    Forbidden.pipe(HttpApiSchema.status(403)),
  ],
}) {}
