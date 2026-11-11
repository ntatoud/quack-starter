import { defineConfig } from "vite-plus";

const GENERATED = ["**/routeTree.gen.ts", "pnpm-lock.yaml", "dist", ".output", "node_modules"];

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
    jsPlugins: ["@quack/oxlint-plugin"],
    categories: {
      correctness: "error",
      suspicious: "warn",
      perf: "warn",
    },
    rules: {
      "eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "react/exhaustive-deps": "error",
      "react/no-array-index-key": "error",
      "react/react-in-jsx-scope": "off",
      "unicorn/no-array-sort": "off",
      // Effect discriminates on `_tag`.
      "eslint/no-underscore-dangle": "off",
    },
    overrides: [
      {
        // Contracts run on the server and in the browser: no platform code, no other workspace package.
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
        // Sources import through the package alias: "#/..." is the package's src folder.
        files: ["apps/*/src/**", "packages/*/src/**"],
        rules: { "quack/no-relative-imports": "error" },
      },
      {
        // Layers of a bounded context: domain, application, infrastructure, http.
        files: ["apps/server/src/modules/**"],
        rules: { "quack/module-boundaries": "error" },
      },
    ],
  },
});
