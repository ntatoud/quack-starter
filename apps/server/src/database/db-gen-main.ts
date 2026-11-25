import { Effect } from "effect";

import { Database } from "#/database/database.ts";
import { runWithEnv } from "#/dev/run-with-env.ts";

// kysely-codegen reads the tables of DATABASE_URL, so the migrations run first: building `Database` runs them.
// `--verify` fails on a db.gen.ts that no longer matches them, instead of writing it.
const migrate = Effect.as(Effect.provide(Effect.void, Database), {});

runWithEnv("db-gen-main.ts [--verify]", ["kysely-codegen", ...process.argv.slice(2)], migrate);
