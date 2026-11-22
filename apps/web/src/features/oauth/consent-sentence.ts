import type { Permission } from "@quack/contracts/permission";

import { listOf } from "#/lib/list-of.ts";

/**
 * What the request asks of the User: a first Grant, more than the Grant they gave (`added`), or that Grant
 * again with nothing new.
 */
export type ConsentAsk =
  | { readonly _tag: "First" }
  | { readonly _tag: "More"; readonly added: ReadonlyArray<Permission> }
  | { readonly _tag: "Again" };

export const consentAsk = ({
  permissions,
  grantedPermissions,
}: {
  readonly permissions: ReadonlyArray<Permission>;
  readonly grantedPermissions: ReadonlyArray<Permission> | null;
}): ConsentAsk => {
  if (grantedPermissions === null) return { _tag: "First" };
  const added = permissions.filter((permission) => !grantedPermissions.includes(permission));

  return added.length > 0 ? { _tag: "More", added } : { _tag: "Again" };
};

/**
 * The centrepiece of the consent page: "Claude, from claude.ai, wants todos:list and todos:write", or for
 * more than a Grant the User gave, only what it adds: "now also wants todos:write".
 */
export const consentSentence = (
  aiClient: { readonly name: string; readonly host: string },
  permissions: ReadonlyArray<Permission>,
  ask: ConsentAsk,
) => {
  const from = `${aiClient.name}, from ${aiClient.host},`;

  return ask._tag === "More"
    ? `${from} now also wants ${listOf(ask.added)}`
    : `${from} wants ${listOf(permissions)}`;
};
