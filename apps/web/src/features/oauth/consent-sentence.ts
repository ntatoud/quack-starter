import type { Permission } from "@quack/contracts/permission";

const listOf = (words: ReadonlyArray<string>) =>
  words.length <= 2 ? words.join(" and ") : `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`;

/**
 * The centrepiece of the consent page: "Claude, from claude.ai, wants todos:list and todos:write", or to an
 * AI Client the User already gave a Grant, what it asks for beyond it: "now also wants todos:write".
 */
export const consentSentence = (
  aiClient: { readonly name: string; readonly host: string },
  permissions: ReadonlyArray<Permission>,
  granted: ReadonlyArray<Permission> | null,
) => {
  const added = permissions.filter((permission) => !granted?.includes(permission));
  const from = `${aiClient.name}, from ${aiClient.host},`;

  return granted !== null && added.length > 0
    ? `${from} now also wants ${listOf(added)}`
    : `${from} wants ${listOf(permissions)}`;
};
