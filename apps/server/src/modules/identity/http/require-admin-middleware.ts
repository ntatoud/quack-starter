import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Forbidden } from "@quack/contracts/identity/identity-errors";
import { RequireAdmin } from "@quack/contracts/identity/require-admin";
import { Effect, Layer } from "effect";

export const RequireAdminMiddleware = Layer.succeed(
  RequireAdmin,
  RequireAdmin.of(
    Effect.fn(function* (httpEffect) {
      const { role } = yield* CurrentUser;
      if (role !== "admin") {
        return yield* new Forbidden();
      }
      return yield* httpEffect;
    }),
  ),
);
