import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Forbidden } from "@quack/contracts/identity/identity-errors";
import type { User } from "@quack/contracts/identity/user";
import { type Permission, RequiredPermission } from "@quack/contracts/permission";
import { Context, Effect, Option } from "effect";
import type { HttpApiEndpoint } from "effect/http-api";

import { stepUpScope } from "#/modules/identity/domain/grant.ts";

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

/** What a Grant's caller may do with an endpoint: call it, ask their User for `scope` first, or nothing. */
export type Access =
  | { readonly _tag: "Allowed" }
  | { readonly _tag: "StepUp"; readonly scope: ReadonlyArray<Permission> }
  | { readonly _tag: "Refused" };

/** By the check of `authorize`: a Grant lacking the Permission steps up, unless no Grant may hold it. */
export const accessTo = (
  endpoint: HttpApiEndpoint.Top,
  permissions: ReadonlySet<Permission>,
): Effect.Effect<Access> =>
  Effect.match(authorize(endpoint, permissions), {
    onSuccess: (): Access => ({ _tag: "Allowed" }),
    onFailure: ({ permission }): Access =>
      Option.match(
        Option.flatMap(Option.fromNullishOr(permission), (missing) =>
          stepUpScope(permissions, missing),
        ),
        {
          onNone: () => ({ _tag: "Refused" }),
          onSome: (scope) => ({ _tag: "StepUp", scope }),
        },
      ),
  });

/** Runs the handler of `endpoint` with `caller` as the Current User, once they may call it. */
export const callAs = <A, E, R>(
  handler: Effect.Effect<A, E, R>,
  endpoint: HttpApiEndpoint.Top,
  { user, permissions }: Caller,
) =>
  authorize(endpoint, permissions).pipe(
    Effect.andThen(Effect.annotateCurrentSpan({ "user.id": user.id, "user.role": user.role })),
    Effect.andThen(
      handler.pipe(Effect.provideService(CurrentUser, user), Effect.annotateLogs("user.id", user.id)),
    ),
  );
