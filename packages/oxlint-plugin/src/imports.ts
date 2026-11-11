import type { ESTree, Visitor } from "vite-plus/lint/plugins";

type Node = ESTree.Node;

/**
 * The specifier of a module source node: a string literal, or a template literal,
 * of which only the text before the first `${}` is known.
 */
const specifierOf = (source: Node | null): string | undefined => {
  if (source === null) return undefined;
  if (source.type === "Literal") {
    return typeof source.value === "string" ? source.value : undefined;
  }
  if (source.type === "TemplateLiteral") return source.quasis[0]?.value.cooked ?? undefined;
  return undefined;
};

/**
 * Visits every place a file names another module: `import`, `export ... from`,
 * dynamic `import()`, and the type-level `import("...")`.
 */
export const forEachImport = (visit: (specifier: string, node: Node) => void): Visitor => {
  const check = (node: Node, source: Node | null) => {
    const specifier = specifierOf(source);
    if (specifier !== undefined) visit(specifier, source ?? node);
  };
  return {
    ImportDeclaration: (node) => check(node, node.source),
    ExportNamedDeclaration: (node) => check(node, node.source),
    ExportAllDeclaration: (node) => check(node, node.source),
    ImportExpression: (node) => check(node, node.source),
    TSImportType: (node) => check(node, node.source),
  };
};

export const isRelative = (specifier: string) =>
  specifier === "." ||
  specifier === ".." ||
  specifier.startsWith("./") ||
  specifier.startsWith("../");
