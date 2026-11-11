import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

import rule from "#/rules/no-relative-imports.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const filename = "/repo/apps/web/src/features/todos/queries.ts";
const error = (specifier: string) => ({
  message: `Relative import "${specifier}". Use the package alias instead: "#/..." maps to this package's src folder.`,
});

new RuleTester().run("no-relative-imports", rule, {
  valid: [
    { filename, code: `import { callApi } from "#/lib/api";` },
    { filename, code: `import { Effect } from "effect";` },
    { filename, code: `import "@quack/ui/globals.css";` },
    { filename, code: `export { env } from "#/lib/env";` },
    { filename, code: `export * from "#/lib/env";` },
    { filename, code: `export const load = () => import("#/lib/api");` },
    { filename, code: `export const load = (name: string) => import(name);` },
    // Not a path: a package whose name starts with a dot is still not relative.
    { filename, code: `import x from ".hidden";` },
    { filename, code: `const env = 1; export { env };` },
  ],
  invalid: [
    { filename, code: `import { env } from "./env";`, errors: [error("./env")] },
    { filename, code: `import { draft } from "../draft";`, errors: [error("../draft")] },
    { filename, code: `import type { Draft } from "../draft";`, errors: [error("../draft")] },
    { filename, code: `import all from "..";`, errors: [error("..")] },
    { filename, code: `import "./styles.css";`, errors: [error("./styles.css")] },
    {
      filename,
      code: `import logo from "../assets/logo.svg";`,
      errors: [error("../assets/logo.svg")],
    },
    { filename, code: `export { env } from "./env";`, errors: [error("./env")] },
    { filename, code: `export * from "./env";`, errors: [error("./env")] },
    { filename, code: `export * as env from "./env";`, errors: [error("./env")] },
    { filename, code: `export const load = () => import("./api");`, errors: [error("./api")] },
    {
      filename,
      code: "export const load = (name: string) => import(`./pages/${name}`);",
      errors: [error("./pages/")],
    },
    { filename, code: `export type Env = import("./env").Env;`, errors: [error("./env")] },
  ],
});
