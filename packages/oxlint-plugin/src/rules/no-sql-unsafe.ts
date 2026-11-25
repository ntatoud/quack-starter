import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";

const isKey = (key: ESTree.Node, computed: boolean, names: ReadonlyArray<string>) =>
  computed
    ? key.type === "Literal" && names.some((name) => name === key.value)
    : key.type === "Identifier" && names.includes(key.name);

// Kysely's `sql.raw` and `sql.lit` write their argument into the SQL text, unescaped and unbound.
const raw = ["raw", "lit"];

// The Kysely of Effect runs the text Kysely compiled, whose values are all bound parameters.
const mayRunUnsafe = (filename: string) =>
  /\/src\/database\/migrations\//.test(filename) ||
  filename.endsWith("/packages/effect-kysely/src/kysely.ts");

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep sql.unsafe, which sends its text unescaped, to the migrations and the executor of @quack/effect-kysely; ban Kysely's sql.raw and sql.lit everywhere.",
    },
  },
  create: (context) => {
    const unsafeAllowed = mayRunUnsafe(context.filename.replaceAll("\\", "/"));
    // `sql`, and any name Kysely's `sql` is imported under.
    const kyselySql = new Set(["sql"]);

    const isKyselySql = (node: ESTree.Node | null) =>
      node?.type === "Identifier" && kyselySql.has(node.name);

    const reportUnsafe = (node: ESTree.Node) => {
      if (unsafeAllowed) return;

      context.report({
        node,
        message:
          "sql.unsafe sends its text unescaped. Write a sql`...` template, whose values are bound parameters; only a migration, in database/migrations/, may use sql.unsafe.",
      });
    };

    const reportRaw = (node: ESTree.Node) =>
      context.report({
        node,
        message:
          "sql.raw and sql.lit write their value into the SQL text. Interpolate it in Kysely's sql`...`, which binds it as a parameter, or use sql.ref for a column.",
      });

    return {
      ImportDeclaration: (node) => {
        if (node.source.value !== "kysely") return;

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && isKey(specifier.imported, false, ["sql"])) {
            kyselySql.add(specifier.local.name);
          }
        }
      },
      MemberExpression: (node) => {
        if (isKey(node.property, node.computed, ["unsafe"])) reportUnsafe(node);

        if (isKyselySql(node.object) && isKey(node.property, node.computed, raw)) reportRaw(node);
      },
      ObjectPattern: (node) => {
        for (const property of node.properties) {
          if (property.type === "Property" && isKey(property.key, property.computed, ["unsafe"])) {
            reportUnsafe(property);
          }
        }
      },
      VariableDeclarator: (node) => {
        if (node.id.type !== "ObjectPattern" || !isKyselySql(node.init)) return;

        for (const property of node.id.properties) {
          if (property.type === "Property" && isKey(property.key, property.computed, raw)) {
            reportRaw(property);
          }
        }
      },
    };
  },
});
