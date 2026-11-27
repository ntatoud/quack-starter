import * as Path from "node:path/posix";

import { defineRule } from "vite-plus/lint/plugins";

const isTest = (path: string) => /\.test\.tsx?$/.test(path);

type Options = ReadonlyArray<{ readonly allow: string[] }>;

export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "A test file sits only at a tested interface, which the `allow` globs name, relative to the linter's cwd; it is judged by its path.",
    },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");

    if (!isTest(filename)) return {};
    // The linter checks the options against `schema` before the rule runs.
    const allow = (context.options as Options)[0]?.allow ?? [];

    // Relative, as `**` crosses no dot folder, and a worktree may sit in one.
    const path = Path.relative(context.cwd.replaceAll("\\", "/"), filename);

    if (allow.some((glob) => Path.matchesGlob(path, glob))) return {};

    return {
      // On the first line: the whole file would print it all.
      Program: () =>
        context.report({
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
          message:
            "A test sits only at a tested interface, and this path is none: test it through its module's index.ts.",
        }),
    };
  },
});
