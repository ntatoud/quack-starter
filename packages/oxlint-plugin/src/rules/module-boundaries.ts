import * as Fs from "node:fs";
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

/** The server's modules and the web app's features: both are modules. */
type Area = "modules" | "features";

interface Location {
  readonly src: string;
  readonly area: Area;
  readonly module: string;
  readonly rest: string;
  /** Undefined for a file at the module's root, such as its `index.ts`. */
  readonly folder: Folder | undefined;
}

const isLayer = (name: string | undefined): name is Layer => LAYERS.includes(name as Layer);
const isFolder = (name: string | undefined): name is Folder => name === "testing" || isLayer(name);
const isTest = (path: string) => /\.test\.tsx?$/.test(path);
const srcOf = (path: string) => /^(.*\/src)\//.exec(path)?.[1];

const locate = (path: string): Location | undefined => {
  const match = /^(.*\/src)\/(modules|features)\/([^/]+)\/(.+)$/.exec(path);

  if (match === null) return undefined;
  const [, src, area, module, rest] = match;

  if (src === undefined || module === undefined || rest === undefined) return undefined;
  const folder = rest.includes("/") ? rest.split("/")[0] : undefined;

  return {
    src,
    area: area === "features" ? "features" : "modules",
    module,
    rest,
    folder: area === "modules" && isFolder(folder) ? folder : undefined,
  };
};

/**
 * A module that has moved to the index.ts and lib/ shape. The others keep the layer rule until they move. Read anew
 * each time, as an editor keeps the linter running while a module moves.
 */
const hasLib = ({ src, area, module }: Location) =>
  Fs.statSync(`${src}/${area}/${module}/lib`, { throwIfNoEntry: false })?.isDirectory() ?? false;

const throughIndex = (to: Location) =>
  `Import another module through its index.ts (#/${to.area}/${to.module}/index.ts), not its internals.`;

/** Only the testing module reaches into another module's lib/, to make state no interface can make. */
const libImportMessage = (from: Location | undefined, to: Location) => {
  if (/^index(\.tsx?)?$/.test(to.rest)) return undefined;
  const sameArea = from?.area === to.area;

  if (sameArea && from.module === to.module) return undefined;

  if (sameArea && from.module === "testing" && to.rest.startsWith("lib/")) return undefined;

  return throughIndex(to);
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
    return throughIndex(to);
  }

  if (isLayer(from.folder) && !ALLOWED[from.folder].layers.some((layer) => layer === to.folder)) {
    return ALLOWED[from.folder].message;
  }

  return undefined;
};

const moduleImportMessage = (
  filename: string,
  from: Location | undefined,
  to: Location,
  fromTesting: boolean,
) => {
  if (hasLib(to)) return libImportMessage(from, to);

  if (to.folder === undefined) return undefined;

  if (to.folder === "testing") return testingImportMessage(filename, from, to, fromTesting);

  return layerImportMessage(from, { ...to, folder: to.folder });
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

  return to === undefined ? undefined : moduleImportMessage(filename, from, to, fromTesting);
};

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Use a module through its index.ts, from other modules and from the rest of src alike. A module with a lib/ hides it from all but the testing module. A module without one keeps its layers apart until it moves: the domain is pure, use cases see the domain only, and its testing/ folder is for tests only.",
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
