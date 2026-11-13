import { definePlugin } from "vite-plus/lint/plugins";

import moduleBoundaries from "#/rules/module-boundaries.ts";
import noRelativeImports from "#/rules/no-relative-imports.ts";
import noUselessComments from "#/rules/no-useless-comments.ts";

export default definePlugin({
  meta: { name: "quack" },
  rules: {
    "module-boundaries": moduleBoundaries,
    "no-relative-imports": noRelativeImports,
    "no-useless-comments": noUselessComments,
  },
});
