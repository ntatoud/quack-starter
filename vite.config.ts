import antiSlop from "ultracite/oxlint/anti-slop";
import { defineConfig } from "vite-plus";

// .agents/skills: installed by `npx skills`, kept as its authors wrote them.
const GENERATED = [
  "**/*.gen.ts",
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
    jsPlugins: ["@shadcn/lint", "@quack/oxlint-plugin", ...(antiSlop.jsPlugins ?? [])],
    settings: {
      shadcn: { ui: "@quack/ui/components", themeImports: ["^@quack/ui/", "^@quack/brand/"] },
    },
    categories: {
      correctness: "error",
      suspicious: "warn",
      perf: "warn",
    },
    rules: {
      ...antiSlop.rules,
      "shadcn/no-raw-colors": "error",
      "shadcn/no-inline-styles": "error",
      "shadcn/no-unknown-classes": "error",
      "shadcn/require-static-classes": "error",
      // This repo does not justify each type assertion in a `SAFETY:` comment.
      "anti-slop/require-safety-comment-for-type-assertion": "off",
      "eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // The web app compiles with the React Compiler, and these rules are its diagnostics: `correctness` holds only
      // some of them. The restriction ones report code the compiler gives up on, which then runs without memoization.
      "react/capitalized-calls": "error",
      "react/exhaustive-effect-dependencies": "error",
      "react/hooks": "error",
      "react/invariant": "error",
      "react/memo-dependencies": "error",
      "react/no-deriving-state-in-effects": "error",
      "react/rule-suppression": "error",
      "react/syntax": "error",
      "react/todo": "error",
      "react/unsupported-syntax": "error",
      // `exhaustive-effect-dependencies` checks the dependencies against what the compiler memoizes; this one takes
      // every value computed in render for new on each, and asks for the useMemo the compiler makes needless.
      "react/exhaustive-deps": "off",
      // The compiler memoizes a context value built in render, as it does any other.
      "react/jsx-no-constructed-context-values": "off",
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
        files: ["**/*.test.ts", "**/*.test.tsx"],
        rules: {
          // A helper or component used by one test or `describe` sits in it, next to what reads it.
          "unicorn/consistent-function-scoping": "off",
          // Key presses, focus moves, and requests happen in order; each step asserts on the one before.
          "eslint/no-await-in-loop": "off",
          // A test sizes the box it renders into with the numbers it asserts on.
          "shadcn/no-inline-styles": "off",
        },
      },
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
        files: ["apps/server/src/**"],
        rules: { "quack/module-boundaries": "error", "quack/no-sql-unsafe": "error" },
      },
      {
        // The Migrator reads a migration's id and name from its file name: <4-digit id>_<snake_case_name>.ts.
        files: ["apps/server/src/database/migrations/**"],
        rules: { "unicorn/filename-case": "off" },
      },
    ],
  },
});
