import { Context, Schema } from "effect";

import { HabitsPermission } from "#/habits/habits-permissions.ts";
import { TodosPermission } from "#/todos/todos-permissions.ts";
import { UsersPermission } from "#/users/users-permissions.ts";

export const Permission = Schema.Literals([
  ...HabitsPermission.literals,
  ...TodosPermission.literals,
  ...UsersPermission.literals,
]);

export type Permission = typeof Permission.Type;

/**
 * Annotates an endpoint behind `Authentication` with the Permission its caller needs, as
 * `.annotate(RequiredPermission, "todos:list")`, or `"none"` to let any signed-in caller through.
 * An endpoint that declares nothing is refused to everyone: the check fails closed.
 */
export class RequiredPermission extends Context.Service<RequiredPermission, Permission | "none">()(
  "@quack/contracts/RequiredPermission",
) {}
