import type { GrantablePermission } from "@quack/contracts/grants/grant";

import { listOf } from "#/lib/list-of.ts";

/** A Permission in the words of a User: what it lets an AI Client do, as a badge says it and as verbs. */
export const permissionWords: Record<
  GrantablePermission,
  { readonly label: string; readonly verbs: ReadonlyArray<string> }
> = {
  "todos:list": { label: "See todos", verbs: ["see"] },
  "todos:write": { label: "Create and complete todos", verbs: ["create", "complete"] },
  "todos:delete": { label: "Delete todos", verbs: ["delete"] },
};

/** Whose loss a User cannot undo: shown in the destructive style. */
export const destroys = (permission: GrantablePermission) => permission === "todos:delete";

/** "see, create, complete, and delete your todos" */
export const actionsOf = (permissions: ReadonlyArray<GrantablePermission>) =>
  `${listOf(permissions.flatMap((permission) => permissionWords[permission].verbs))} your todos`;
