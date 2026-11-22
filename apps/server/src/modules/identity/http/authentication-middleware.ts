import { Authentication, CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect, Layer, Option } from "effect";

import { Identity } from "#/modules/identity/application/identity.ts";
import { roleAllows } from "#/modules/identity/domain/role-permissions.ts";
import { authorize } from "#/modules/identity/http/authorize.ts";
import { McpCaller } from "#/modules/identity/http/mcp-caller.ts";
import { SessionCookie } from "#/modules/identity/http/session-cookie.ts";

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
          const { user, permissions } = mcpCaller.value;
          yield* authorize(endpoint, (permission) => permissions.has(permission));
          return yield* Effect.provideService(httpEffect, CurrentUser, user);
        }
        const { user, extendedUntil } = yield* identity
          .authenticate(credential)
          .pipe(Effect.tapError(() => cookie.clear));
        if (Option.isSome(extendedUntil)) {
          yield* cookie.set({ token: credential, expiresAt: extendedUntil.value });
        }
        yield* authorize(endpoint, (permission) => roleAllows(user.role, permission));
        return yield* Effect.provideService(httpEffect, CurrentUser, user);
      }),
    });
  }),
);
