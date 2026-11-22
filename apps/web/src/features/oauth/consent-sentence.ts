import type { Permission } from "@quack/contracts/permission";

const listOf = (words: ReadonlyArray<string>) =>
  words.length <= 2 ? words.join(" and ") : `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`;

/** The centrepiece of the consent page: "Claude, from claude.ai, wants todos:list and todos:write". */
export const consentSentence = (
  aiClient: { readonly name: string; readonly host: string },
  permissions: ReadonlyArray<Permission>,
) => `${aiClient.name}, from ${aiClient.host}, wants ${listOf(permissions)}`;
