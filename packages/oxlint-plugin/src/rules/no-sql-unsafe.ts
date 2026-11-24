import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";

const isUnsafe = (key: ESTree.Node, computed: boolean) =>
  computed
    ? key.type === "Literal" && key.value === "unsafe"
    : key.type === "Identifier" && key.name === "unsafe";

// The Kysely of Effect runs the text Kysely compiled, whose values are all bound parameters.
const mayRunText = (filename: string) =>
  /\/src\/database\/migrations\//.test(filename) ||
  filename.endsWith("/packages/effect-kysely/src/kysely.ts");

// Kysely's `sql.raw` and `sql.lit` write their argument into the SQL text, unescaped and unbound.
const isKyselyRaw = (node: ESTree.MemberExpression) =>
  node.object.type === "Identifier" &&
  node.object.name === "sql" &&
  !node.computed &&
  node.property.type === "Identifier" &&
  (node.property.name === "raw" || node.property.name === "lit");

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Keep sql.unsafe, which sends its text unescaped, to the migrations.",
    },
  },
  create: (context) => {
    if (mayRunText(context.filename.replaceAll("\\", "/"))) return {};

    const report = (node: ESTree.Node) =>
      context.report({
        node,
        message:
          "sql.unsafe sends its text unescaped. Write a sql`...` template, whose values are bound parameters; only a migration, in database/migrations/, may use sql.unsafe.",
      });

    return {
      MemberExpression: (node) => {
        if (isUnsafe(node.property, node.computed)) report(node);

        if (isKyselyRaw(node)) {
          context.report({
            node,
            message:
              "sql.raw and sql.lit write their value into the SQL text. Interpolate it in Kysely's sql`...`, which binds it as a parameter, or use sql.ref for a column.",
          });
        }
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
