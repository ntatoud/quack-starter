import * as Path from "node:path/posix";

import { defineRule } from "vite-plus/lint/plugins";

import { forEachImport, isRelative } from "#/imports.ts";

const LAYERS = ["domain", "application", "infrastructure", "http"] as const;
type Layer = (typeof LAYERS)[number];

/** What a layer may import from the other layers of its own module. */
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

/** Packages the domain may not import: platform and transport code. */
const isPlatformOrTransport = (specifier: string) =>
  specifier.startsWith("node:") ||
  specifier.startsWith("@effect/platform-") ||
  /^effect\/http(-api)?(\/|$)/.test(specifier);

interface Location {
  /** The package's `src` folder. */
  readonly src: string;
  readonly module: string;
  /** Undefined for a file at the module's root, such as its `index.ts`. */
  readonly layer: Layer | undefined;
}

const isLayer = (name: string | undefined): name is Layer => LAYERS.includes(name as Layer);

/** Where a path sits under `src/modules/<module>/<layer>/`, if it does. */
const locate = (path: string): Location | undefined => {
  const match = /^(.*\/src)\/modules\/([^/]+)\/(?:([^/]+)\/)?/.exec(path);
  if (match === null) return undefined;
  const [, src, module, folder] = match;
  if (src === undefined || module === undefined) return undefined;
  return { src, module, layer: isLayer(folder) ? folder : undefined };
};

/** The path a specifier points at, for the specifiers that stay inside the package. */
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
        "Keep the layers of a module apart: the domain is pure, use cases see the domain only, and a module is used through its index.ts.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    const from = locate(filename);
    if (from === undefined) return {};

    return forEachImport((specifier, node) => {
      if (from.layer === "domain" && isPlatformOrTransport(specifier)) {
        context.report({
          node,
          message: "The domain stays free of platform and transport code.",
        });
        return;
      }

      const target = resolve(specifier, filename, from.src);
      const to = target === undefined ? undefined : locate(target);
      if (to?.layer === undefined) return;

      if (to.module !== from.module) {
        context.report({
          node,
          message: `Import another module through its index.ts (#/modules/${to.module}/index.ts), not its internals.`,
        });
        return;
      }

      if (from.layer !== undefined && !ALLOWED[from.layer].layers.includes(to.layer)) {
        context.report({ node, message: ALLOWED[from.layer].message });
      }
    });
  },
});
