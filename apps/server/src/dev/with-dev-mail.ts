import { Effect } from "effect";

import { devMailEnv } from "#/dev/dev-mail-env.ts";
import { runWithEnv } from "#/dev/run-with-env.ts";

// Run with .env loaded, so a value set there is kept rather than replaced by the default.
runWithEnv(
  "with-dev-mail.ts <command> [...args]",
  process.argv.slice(2),
  Effect.sync(() => devMailEnv(process.env)),
);
