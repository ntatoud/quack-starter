import { defineRule, type ESTree } from "vite-plus/lint/plugins";

type Comment = ESTree.Comment;

// Read by tools, not by people.
const DIRECTIVE =
  /^(oxlint-|eslint-|eslint |prettier-ignore|@ts-|@vitest-|@jsx|@refresh|#__|@__|@effect-|biome-|istanbul |c8 |v8 |global )/;

const NARRATION =
  /^(port\.|adapter\.|composition of|use cases? of|helper|wrapper|mirrors|this (function|component|hook|class|file|method|module|type|test)|here we|now we|we (now|then)|step \d+|first,|then,|finally,)/i;

const CODE = [
  /^(import|export)\s.*\bfrom\s/,
  /^(const|let|var)\s+[\w${}[\],\s]+=/,
  /^(if|for|while|switch)\s*\(.*\)\s*\{?$/,
  /^(return|await|yield|throw)\b.*;$/,
  /^[\w$.]+\(.*\);?$/,
  /;$/,
  /^\}/,
  /\{$/,
];

// Words that say nothing a name would not: what is left of a comment without them must say something.
const FILLER = new Set(
  (
    "a an the of to in on for by with from as at and or nor is are was be been being it its this that these those " +
    "which what when where who whom how one each every all any some no not into onto than then there here do does " +
    "done has have had will would can could should may might must shall so such also only just very " +
    "value values function method class type interface variable constant helper wrapper object instance " +
    "return returns returned get gets set sets create creates make makes use uses used given new current number"
  ).split(" "),
);

const stem = (word: string) =>
  word.length > 4 && word.endsWith("ies")
    ? `${word.slice(0, -3)}y`
    : word.replace(/(?<=\w{3})(es|s|ed|ing)$/, "");

const wordsOf = (text: string) =>
  (text.match(/[A-Za-z]+/g) ?? [])
    .flatMap((word) => word.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .map((word) => word.toLowerCase());

const contentOf = (comment: Comment) =>
  comment.value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, "").trim())
    .filter((line) => line !== "" && line !== "*");

/** Line comments on consecutive lines read as one. */
const groupsOf = (comments: ReadonlyArray<Comment>, text: string) => {
  const groups: Array<Array<Comment>> = [];

  for (const comment of comments) {
    if (comment.type === "Shebang") continue;
    const last = groups.at(-1)?.at(-1);

    const adjacent =
      last !== undefined &&
      last.type === "Line" &&
      comment.type === "Line" &&
      /^[^\S\n]*\n[^\S\n]*$/.test(text.slice(last.end, comment.start));

    if (adjacent) groups.at(-1)?.push(comment);
    else groups.push([comment]);
  }

  return groups;
};

/** The code a comment is about: the rest of its own line when it trails code, the next line of code otherwise. */
const describedCode = (text: string, start: number, end: number) => {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const before = text.slice(lineStart, start).replace(/[\s{]/g, "");

  if (before !== "") return text.slice(lineStart, start);

  return text.slice(end).trimStart().split("\n")[0] ?? "";
};

/** Why a group of comment lines should go, if it should. */
const complaintAbout = (prose: ReadonlyArray<string>, described: string) => {
  if (prose.some((line) => CODE.some((pattern) => pattern.test(line)))) {
    return "Commented-out code. Delete it: git keeps the history.";
  }

  if (NARRATION.test(prose[0] ?? "")) {
    return "The comment narrates what the code is. Delete it, or say why the code is the way it is.";
  }

  const named = new Set(wordsOf(described).map((word) => stem(word)));

  const said = wordsOf(prose.join(" "))
    .filter((word) => !FILLER.has(word))
    .map((word) => stem(word));

  const unnamed = said.filter((word) => !named.has(word)).length;

  if (said.length > 0 && unnamed <= Math.floor(said.length / 4)) {
    return "The comment restates the code next to it. Delete it, or say why the code is the way it is.";
  }

  return undefined;
};

export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "A comment says why, or what the code cannot show: not what the code or its names already say.",
    },
  },
  create: (context) => ({
    Program: () => {
      const { sourceCode } = context;
      const text = sourceCode.text;

      for (const group of groupsOf(sourceCode.getAllComments(), text)) {
        const first = group[0];
        const last = group.at(-1);

        if (first === undefined || last === undefined) continue;
        const lines = group.flatMap(contentOf);
        const prose = lines.filter((line) => !line.startsWith("@"));

        if (prose.length === 0 || DIRECTIVE.test(lines[0] ?? "")) continue;

        const message = complaintAbout(prose, describedCode(text, first.start, last.end));

        if (message === undefined) continue;
        context.report({
          loc: { start: sourceCode.getLoc(first).start, end: sourceCode.getLoc(last).end },
          message,
        });
      }
    },
  }),
});
