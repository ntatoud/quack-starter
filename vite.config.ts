import antiSlop from "ultracite/oxlint/anti-slop";
import { defineConfig } from "vite-plus";

// .agents/skills: installed by `npx skills`, kept as its authors wrote them.
const GENERATED = [
  "**/routeTree.gen.ts",
  "pnpm-lock.yaml",
  "dist",
  ".output",
  "node_modules",
  ".agents/skills",
];

export default defineConfig({
  staged: {
    // In order, so lint reads the formatted file.
    "*": ["vp fmt --no-error-on-unmatched-pattern", "vp lint --no-error-on-unmatched-pattern"],
  },
  fmt: {
    ignorePatterns: GENERATED,
    sortPackageJson: {},
  },
  lint: {
    ignorePatterns: GENERATED,
    plugins: ["eslint", "oxc", "react", "unicorn", "typescript"],
    jsPlugins: ["@quack/oxlint-plugin", ...(antiSlop.jsPlugins ?? [])],
    categories: {
      correctness: "error",
      suspicious: "warn",
      perf: "warn",
    },
    rules: {
      ...antiSlop.rules,
      // This repo does not justify each type assertion in a `SAFETY:` comment.
      "anti-slop/require-safety-comment-for-type-assertion": "off",
      "eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "react/exhaustive-deps": "error",
      "react/no-array-index-key": "error",
      "react/react-in-jsx-scope": "off",
      "unicorn/no-array-sort": "off",
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "quack/no-useless-comments": "error",
      // Effect discriminates on `_tag`.
      "eslint/no-underscore-dangle": "off",
    },
    overrides: [
      {
        files: ["packages/contracts/src/**"],
        rules: {
          "eslint/no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: ["node:*", "@effect/platform-*", "@effect/platform-*/**", "@quack/**"],
                  message: "Contracts hold schemas and API definitions only.",
                },
              ],
            },
          ],
        },
      },
      {
        files: ["apps/*/src/**", "packages/*/src/**"],
        rules: { "quack/no-relative-imports": "error" },
      },
      {
        files: ["apps/server/src/modules/**"],
        rules: { "quack/module-boundaries": "error" },
      },
      {
        files: ["apps/server/src/**"],
        rules: { "quack/no-sql-unsafe": "error" },
      },
      {
        // The Migrator reads a migration's id and name from its file name: <4-digit id>_<snake_case_name>.ts.
        files: ["apps/server/src/database/migrations/**"],
        rules: { "unicorn/filename-case": "off" },
      },
    ],
  },
});
