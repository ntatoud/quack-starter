import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Forbidden } from "@quack/contracts/identity/identity-errors";
import type { User } from "@quack/contracts/identity/user";
import { type Permission, RequiredPermission } from "@quack/contracts/permission";
import { Context, Effect, Option } from "effect";
import type { HttpApiEndpoint } from "effect/http-api";

/** Who makes a request: the Current User, with the Permissions of their Role or of their Grant. */
export interface Caller {
  readonly user: User;
  readonly permissions: ReadonlySet<Permission>;
}

/** Fails closed: an endpoint that declares no `RequiredPermission` is refused to every caller. */
export const authorize = (endpoint: HttpApiEndpoint.Top, permissions: ReadonlySet<Permission>) =>
  Option.match(Context.getOption(endpoint.annotations, RequiredPermission), {
    onNone: () => Effect.fail(new Forbidden({})),
    onSome: (permission) =>
      permission === "none" || permissions.has(permission)
        ? Effect.void
        : Effect.fail(new Forbidden({ permission })),
  });

/** Runs the handler of `endpoint` with `caller` as the Current User, once they may call it. */
export const callAs = <A, E, R>(
  handler: Effect.Effect<A, E, R>,
  endpoint: HttpApiEndpoint.Top,
  { user, permissions }: Caller,
) =>
  authorize(endpoint, permissions).pipe(
    Effect.andThen(Effect.provideService(handler, CurrentUser, user)),
  );
