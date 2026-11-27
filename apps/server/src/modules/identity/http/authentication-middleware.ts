import { Authentication } from "@quack/contracts/identity/authentication";
import { Effect, Layer, Option } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { callAs } from "#/modules/identity/http/authorize.ts";
import { McpCaller } from "#/modules/identity/http/mcp-caller.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";
import { rolePermissions } from "#/modules/users/index.ts";

export const AuthenticationMiddleware = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const identity = yield* Identity;
    const cookie = yield* SessionCookie;

    return Authentication.of({
      session: Effect.fn(function* (httpEffect, { credential, endpoint }) {
        // Only the MCP transport calls the `Api` in process with a caller; no request from the network
        // can put one in the context.
        const mcpCaller = yield* Effect.serviceOption(McpCaller);

        if (Option.isSome(mcpCaller)) {
          return yield* callAs(httpEffect, endpoint, mcpCaller.value);
        }

        const { user, extendedUntil } = yield* identity
          .authenticate(credential)
          .pipe(Effect.tapError(() => cookie.clear));

        if (Option.isSome(extendedUntil)) {
          yield* cookie.set({ token: credential, expiresAt: extendedUntil.value });
        }

        return yield* callAs(httpEffect, endpoint, {
          user,
          permissions: rolePermissions(user.role),
        });
      }),
    });
  }),
);
