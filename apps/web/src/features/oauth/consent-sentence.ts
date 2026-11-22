import type { Permission } from "@quack/contracts/permission";

/** What each Permission lets an AI Client do, as verbs of "your todos". A Grant never holds `users:*`. */
const verbsOf: Partial<Record<Permission, ReadonlyArray<string>>> = {
  "todos:list": ["see"],
  "todos:write": ["create", "complete"],
  "todos:delete": ["delete"],
};

/** "see", "create and complete", "see, create, complete, and delete". */
const listOf = (words: ReadonlyArray<string>) =>
  words.length <= 2 ? words.join(" and ") : `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`;

/** The centrepiece of the consent page: "Claude, from claude.ai, wants to see your todos". */
export const consentSentence = (
  aiClient: { readonly name: string; readonly host: string },
  permissions: ReadonlyArray<Permission>,
) =>
  `${aiClient.name}, from ${aiClient.host}, wants to ${listOf(
    permissions.flatMap((permission) => verbsOf[permission] ?? [permission]),
  )} your todos`;

export const permissionSummaries: Partial<Record<Permission, string>> = {
  "todos:list": "See the title and completed state of every todo you own",
  "todos:write": "Add todos and mark them completed, as you would",
  "todos:delete": "Remove your todos for good",
};
