import { Effect } from "effect";

import { devDatabaseUrl } from "#/dev/dev-database.ts";
import { runWithEnv } from "#/dev/run-with-env.ts";

const argv = process.argv.slice(2);
const seed = argv[0] === "--seed";

runWithEnv(
  "with-dev-database.ts [--seed] <command> [...args]",
  seed ? argv.slice(1) : argv,
  devDatabaseUrl(process.env, { seed }).pipe(Effect.map((url) => ({ DATABASE_URL: url }))),
);
