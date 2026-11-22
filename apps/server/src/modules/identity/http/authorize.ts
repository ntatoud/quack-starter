import { Forbidden } from "@quack/contracts/identity/identity-errors";
import { type Permission, RequiredPermission } from "@quack/contracts/permission";
import { Context, Effect, Option } from "effect";
import type { HttpApiEndpoint } from "effect/http-api";

/**
 * Whether a caller who `allows` some Permissions may call `endpoint`. Fails closed: an endpoint that
 * declares no `RequiredPermission` is refused to every caller.
 */
export const authorize = (
  endpoint: HttpApiEndpoint.Top,
  allows: (permission: Permission) => boolean,
) =>
  Option.match(Context.getOption(endpoint.annotations, RequiredPermission), {
    onNone: () => Effect.fail(new Forbidden({})),
    onSome: (permission) =>
      permission === "none" || allows(permission)
        ? Effect.void
        : Effect.fail(new Forbidden({ permission })),
  });
