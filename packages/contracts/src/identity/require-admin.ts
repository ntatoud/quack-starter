import { HttpApiMiddleware, HttpApiSchema } from "effect/http-api";

import type { CurrentUser } from "#/identity/authentication.ts";
import { Forbidden } from "#/identity/identity-errors.ts";

/** Declared before `Authentication`, which runs first and provides the `CurrentUser` it reads. */
export class RequireAdmin extends HttpApiMiddleware.Service<
  RequireAdmin,
  { requires: CurrentUser }
>()("@quack/contracts/identity/RequireAdmin", {
  error: Forbidden.pipe(HttpApiSchema.status(403)),
}) {}
