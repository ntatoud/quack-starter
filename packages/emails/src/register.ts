import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

import { transformSync } from "esbuild";

/**
 * Lets Node load the templates, which are `.tsx`: its type stripping leaves JSX alone. Imported with
 * `node --import @quack/emails/register` by whatever loads a module that sends emails outside Vite.
 */
registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith("file:") || !url.endsWith(".tsx")) return nextLoad(url, context);

    const path = fileURLToPath(url);

    const { code } = transformSync(readFileSync(path, "utf8"), {
      loader: "tsx",
      jsx: "automatic",
      format: "esm",
      sourcefile: path,
      sourcemap: "inline",
    });

    return { format: "module", source: code, shortCircuit: true };
  },
});
