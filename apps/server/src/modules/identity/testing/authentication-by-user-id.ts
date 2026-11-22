import { Authentication, CurrentUser } from "@quack/contracts/identity/authentication";
import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import type { User } from "@quack/contracts/identity/user";
import { Effect, Layer, Redacted } from "effect";

import { roleAllows } from "#/modules/identity/domain/role-permissions.ts";
import { authorize } from "#/modules/identity/http/authorize.ts";

/**
 * `Authentication` for tests that need a Current User, not a Session: the session cookie is the
 * id of one of `users`. It checks the Permission of the endpoint as the real middleware does.
 */
export const authenticationByUserId = (users: ReadonlyArray<User>) =>
  Layer.succeed(
    Authentication,
    Authentication.of({
      session: (httpEffect, { credential, endpoint }) => {
        const user = users.find(({ id }) => id === Redacted.value(credential));
        return user === undefined
          ? Effect.fail(new Unauthenticated())
          : authorize(endpoint, (permission) => roleAllows(user.role, permission)).pipe(
              Effect.andThen(Effect.provideService(httpEffect, CurrentUser, user)),
            );
      },
    }),
  );
