/** Each word of a list after the separator a sentence puts before it: "" before the first, then " and ", or ", ". */
export const listParts = <A>(words: ReadonlyArray<A>) =>
  words.map((word, index) => ({
    separator:
      index === 0
        ? ""
        : words.length === 2
          ? " and "
          : index === words.length - 1
            ? ", and "
            : ", ",
    word,
  }));

/** Words joined as a sentence lists them: "a and b", "a, b, and c". */
export const listOf = (words: ReadonlyArray<string>) =>
  listParts(words)
    .map(({ separator, word }) => separator + word)
    .join("");
