import { HttpApiMiddleware, HttpApiSchema } from "effect/http-api";

import type { CurrentUser } from "#/identity/authentication.ts";
import { Forbidden } from "#/identity/identity-errors.ts";
import type { Role } from "#/identity/user.ts";

const error = Forbidden.pipe(HttpApiSchema.status(403));

/** Never provided: it gives `RequireRole` the shape of a middleware, which only a class can name. */
class RoleCheck extends HttpApiMiddleware.Service<RoleCheck, { requires: CurrentUser }>()(
  "@quack/contracts/identity/RoleCheck",
  { error },
) {}

/** The Role is in the type: the middleware of one Role cannot stand in for another. */
export interface RequireRole<R extends Role> extends RoleCheck {
  readonly requiredRole: R;
}

const makeRequireRole = <R extends Role>(role: R) =>
  HttpApiMiddleware.Service<RequireRole<R>, { requires: CurrentUser }>()(
    `@quack/contracts/identity/RequireRole/${role}`,
    { error },
  );

const byRole = new Map<Role, ReturnType<typeof makeRequireRole>>();

/** Declared before `Authentication`, which runs first and provides the `CurrentUser` it reads. */
export const RequireRole = <R extends Role>(role: R): ReturnType<typeof makeRequireRole<R>> => {
  const known = byRole.get(role);
  if (known !== undefined) return known as ReturnType<typeof makeRequireRole<R>>;
  const made = makeRequireRole(role);
  byRole.set(role, made);
  return made;
};
