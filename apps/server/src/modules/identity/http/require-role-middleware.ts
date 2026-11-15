import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Forbidden } from "@quack/contracts/identity/identity-errors";
import { RequireRole } from "@quack/contracts/identity/require-role";
import { Role } from "@quack/contracts/identity/user";
import { Effect, Layer } from "effect";

const requireRoleMiddleware = <R extends Role>(role: R) => {
  const middleware = RequireRole(role);
  return Layer.succeed(
    middleware,
    middleware.of(
      Effect.fn(function* (httpEffect) {
        const user = yield* CurrentUser;
        if (user.role !== role) {
          return yield* new Forbidden();
        }
        return yield* httpEffect;
      }),
    ),
  );
};

const [firstRole, ...otherRoles] = Role.literals;

export const RequireRoleMiddleware = Layer.mergeAll(
  requireRoleMiddleware(firstRole),
  ...otherRoles.map((role) => requireRoleMiddleware(role)),
);
