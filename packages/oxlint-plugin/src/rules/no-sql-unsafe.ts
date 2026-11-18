import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";

const isUnsafe = (key: ESTree.Node, computed: boolean) =>
  computed
    ? key.type === "Literal" && key.value === "unsafe"
    : key.type === "Identifier" && key.name === "unsafe";

const isMigration = (filename: string) => /\/src\/database\/migrations\//.test(filename);

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Keep sql.unsafe, which sends its text unescaped, to the migrations.",
    },
  },
  create: (context) => {
    if (isMigration(context.filename.replaceAll("\\", "/"))) return {};
    const report = (node: ESTree.Node) =>
      context.report({
        node,
        message:
          "sql.unsafe sends its text unescaped. Write a sql`...` template, whose values are bound parameters; only a migration, in database/migrations/, may use sql.unsafe.",
      });
    return {
      MemberExpression: (node) => {
        if (isUnsafe(node.property, node.computed)) report(node);
      },
      ObjectPattern: (node) => {
        for (const property of node.properties) {
          if (property.type === "Property" && isUnsafe(property.key, property.computed)) {
            report(property);
          }
        }
      },
    };
  },
});
