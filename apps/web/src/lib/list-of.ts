/** Words joined as a sentence lists them: "a and b", "a, b, and c". */
export const listOf = (words: ReadonlyArray<string>) =>
  words.length <= 2 ? words.join(" and ") : `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`;
