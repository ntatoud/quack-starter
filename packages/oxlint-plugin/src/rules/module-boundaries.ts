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

const testingImportMessage = (
  filename: string,
  from: Location | undefined,
  to: Location,
  fromTesting: boolean,
) => {
  if (!fromTesting) return "Only a test or another testing/ file imports from a testing/ folder.";

  if (!isTest(filename) && to.module !== from?.module) {
    return "Only a test imports another module's testing/ folder.";
  }

  return undefined;
};

const layerImportMessage = (
  from: Location | undefined,
  to: Location & { readonly folder: Folder },
) => {
  if (from === undefined || to.module !== from.module) {
    return `Import another module through its index.ts (#/modules/${to.module}/index.ts), not its internals.`;
  }

  if (isLayer(from.folder) && !ALLOWED[from.folder].layers.some((layer) => layer === to.folder)) {
    return ALLOWED[from.folder].message;
  }

  return undefined;
};

/** The message of the rule an import breaks, if any. */
const violation = (
  specifier: string,
  filename: string,
  src: string,
  from: Location | undefined,
  fromTesting: boolean,
) => {
  if (from?.folder === "domain" && isPlatformOrTransport(specifier)) {
    return "The domain stays free of platform and transport code.";
  }

  const target = resolve(specifier, filename, src);
  const to = target === undefined ? undefined : locate(target);

  if (to?.folder === undefined) return undefined;

  if (to.folder === "testing") return testingImportMessage(filename, from, to, fromTesting);

  return layerImportMessage(from, { ...to, folder: to.folder });
};

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep the layers of a module apart: the domain is pure, use cases see the domain only, a module is used through its index.ts, from other modules and from the rest of src alike, and its testing/ folder by tests only.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    const src = srcOf(filename);

    if (src === undefined) return {};
    const from = locate(filename);
    const fromTesting = isTest(filename) || from?.folder === "testing";

    return forEachImport((specifier, node) => {
      const message = violation(specifier, filename, src, from, fromTesting);

      if (message !== undefined) context.report({ node, message });
    });
  },
});
