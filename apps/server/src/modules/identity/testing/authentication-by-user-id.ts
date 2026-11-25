import { Authentication } from "@quack/contracts/identity/authentication";
import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import type { User } from "@quack/contracts/identity/user";
import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/http";

import { rolePermissions } from "#/modules/identity/domain/role-permissions.ts";
import { callAs } from "#/modules/identity/http/authorize.ts";

/**
 * `Authentication` for tests that need a Current User, not a Session: the session cookie (`__Host-quack-session`, as on an https origin) is the
 * id of one of `users`. It checks the Permission of the endpoint as the real middleware does.
 */
export const authenticationByUserId = (users: ReadonlyArray<User>) =>
  Layer.succeed(
    Authentication,
    Authentication.of(
      Effect.fn(function* (httpEffect, { endpoint }) {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const user = users.find(({ id }) => id === request.cookies["__Host-quack-session"]);

        return user === undefined
          ? yield* new Unauthenticated()
          : yield* callAs(httpEffect, endpoint, { user, permissions: rolePermissions(user.role) });
      }),
    ),
  );
