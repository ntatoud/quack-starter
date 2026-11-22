import { Forbidden } from "@quack/contracts/identity/identity-errors";
import type { User } from "@quack/contracts/identity/user";
import { RequiredPermission } from "@quack/contracts/permission";
import { Context, Effect, Option } from "effect";
import type { HttpApiEndpoint } from "effect/http-api";

import { roleAllows } from "#/modules/identity/domain/permission.ts";

/** Fails closed: an endpoint that declares no `RequiredPermission` is refused to every caller. */
export const authorize = (endpoint: HttpApiEndpoint.Top, caller: User) =>
  Option.match(Context.getOption(endpoint.annotations, RequiredPermission), {
    onNone: () => Effect.fail(new Forbidden({})),
    onSome: (permission) =>
      permission === null || roleAllows(caller.role, permission)
        ? Effect.void
        : Effect.fail(new Forbidden({ permission })),
  });
