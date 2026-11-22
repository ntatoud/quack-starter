import type { Permission } from "@quack/contracts/permission";

const listOf = (words: ReadonlyArray<string>) =>
  words.length <= 2 ? words.join(" and ") : `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`;

/** What the request asks for beyond the Grant the User already gave, `null` when they gave none. */
export const newPermissions = (request: {
  readonly permissions: ReadonlyArray<Permission>;
  readonly grantedPermissions: ReadonlyArray<Permission> | null;
}) => {
  const { permissions, grantedPermissions } = request;

  return grantedPermissions === null
    ? null
    : permissions.filter((permission) => !grantedPermissions.includes(permission));
};

/**
 * The centrepiece of the consent page: "Claude, from claude.ai, wants todos:list and todos:write", or to an
 * AI Client the User already gave a Grant, what it asks for beyond it: "now also wants todos:write".
 */
export const consentSentence = (
  aiClient: { readonly name: string; readonly host: string },
  permissions: ReadonlyArray<Permission>,
  added: ReadonlyArray<Permission> | null,
) => {
  const from = `${aiClient.name}, from ${aiClient.host},`;

  return added !== null && added.length > 0
    ? `${from} now also wants ${listOf(added)}`
    : `${from} wants ${listOf(permissions)}`;
};
