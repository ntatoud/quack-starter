import { Authentication } from "@quack/contracts/identity/authentication";
import type { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import type { User } from "@quack/contracts/identity/user";
import { Effect, Layer, Option } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { rolePermissions } from "#/modules/identity/domain/role-permissions.ts";
import { callAs } from "#/modules/identity/http/authorize.ts";
import { McpCaller } from "#/modules/identity/http/mcp-caller.ts";

export const AuthenticationMiddleware = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const identity = yield* Identity;

    return Authentication.of(
      Effect.fn(function* (httpEffect, { endpoint }) {
        // Only the MCP transport calls the `Api` in process with a caller; no request from the network
        // can put one in the context.
        const mcpCaller = yield* Effect.serviceOption(McpCaller);

        if (Option.isSome(mcpCaller)) {
          return yield* callAs(httpEffect, endpoint, mcpCaller.value);
        }

        // Yielded's `http.middleware`, around the routes of the `Api` (`server.ts`), puts the `AuthRequest` of
        // every request in its context. A middleware's type cannot say it reads a service of the request.
        const user = yield* identity.authenticate as Effect.Effect<User, Unauthenticated>;

        return yield* callAs(httpEffect, endpoint, {
          user,
          permissions: rolePermissions(user.role),
        });
      }),
    );
  }),
);
