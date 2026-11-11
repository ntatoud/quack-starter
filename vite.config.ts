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
  },
});
