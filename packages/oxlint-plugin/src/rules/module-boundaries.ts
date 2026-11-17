import * as Path from "node:path/posix";

import { defineRule } from "vite-plus/lint/plugins";

import { forEachImport, isRelative } from "#/imports.ts";

const LAYERS = ["domain", "application", "infrastructure", "http"] as const;
type Layer = (typeof LAYERS)[number];
type Folder = Layer | "testing";

const ALLOWED: Record<Layer, { readonly layers: ReadonlyArray<Layer>; readonly message: string }> =
  {
    domain: { layers: ["domain"], message: "The domain depends on no other layer." },
    application: {
      layers: ["domain", "application"],
      message: "Use cases depend on the domain only. Adapters are provided as Layers.",
    },
    infrastructure: { layers: LAYERS, message: "" },
    http: { layers: LAYERS, message: "" },
  };

const isPlatformOrTransport = (specifier: string) =>
  specifier.startsWith("node:") ||
  specifier.startsWith("@effect/platform-") ||
  /^effect\/http(-api)?(\/|$)/.test(specifier);

interface Location {
  readonly src: string;
  readonly module: string;
  /** Undefined for a file at the module's root, such as its `index.ts`. */
  readonly folder: Folder | undefined;
}

const isLayer = (name: string | undefined): name is Layer => LAYERS.includes(name as Layer);
const isFolder = (name: string | undefined): name is Folder => name === "testing" || isLayer(name);
const isTest = (path: string) => /\.test\.tsx?$/.test(path);
const srcOf = (path: string) => /^(.*\/src)\//.exec(path)?.[1];

const locate = (path: string): Location | undefined => {
  const match = /^(.*\/src)\/modules\/([^/]+)\/(?:([^/]+)\/)?/.exec(path);
  if (match === null) return undefined;
  const [, src, module, folder] = match;
  if (src === undefined || module === undefined) return undefined;
  return { src, module, folder: isFolder(folder) ? folder : undefined };
};

/** Undefined for a specifier that leaves the package. */
const resolve = (specifier: string, filename: string, src: string): string | undefined => {
  if (specifier.startsWith("#/")) return Path.join(src, specifier.slice(2));
  if (isRelative(specifier)) return Path.join(Path.dirname(filename), specifier);
  return undefined;
};

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep the layers of a module apart: the domain is pure, use cases see the domain only, a module is used through its index.ts, and its testing/ folder by tests only.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    const src = srcOf(filename);
    if (src === undefined) return {};
    const from = locate(filename);
    const fromTesting = isTest(filename) || from?.folder === "testing";

    return forEachImport((specifier, node) => {
      if (from?.folder === "domain" && isPlatformOrTransport(specifier)) {
        context.report({
          node,
          message: "The domain stays free of platform and transport code.",
        });
        return;
      }

      const target = resolve(specifier, filename, src);
      const to = target === undefined ? undefined : locate(target);
      if (to?.folder === undefined) return;

      if (to.folder === "testing") {
        if (!fromTesting) {
          context.report({
            node,
            message: "Only a test or another testing/ file imports from a testing/ folder.",
          });
        } else if (!isTest(filename) && to.module !== from?.module) {
          context.report({
            node,
            message: "Only a test imports another module's testing/ folder.",
          });
        }
        return;
      }

      if (from === undefined) return;

      if (to.module !== from.module) {
        context.report({
          node,
          message: `Import another module through its index.ts (#/modules/${to.module}/index.ts), not its internals.`,
        });
        return;
      }

      if (isLayer(from.folder) && !ALLOWED[from.folder].layers.includes(to.folder)) {
        context.report({ node, message: ALLOWED[from.folder].message });
      }
    });
  },
});
