import { defineRule } from "vite-plus/lint/plugins";

import { forEachImport, isRelative } from "#/imports.ts";

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Import through the package alias (#/...), never through a relative path.",
    },
  },
  create: (context) =>
    forEachImport((specifier, node) => {
      if (!isRelative(specifier)) return;
      context.report({
        node,
        message: `Relative import "${specifier}". Use the package alias instead: "#/..." maps to this package's src folder.`,
      });
    }),
});
