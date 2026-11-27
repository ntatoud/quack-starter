// PROTOTYPE (wayfinder #260): the database of the Api tests, a PGlite migrated as the server
// migrates Postgres at startup. Build it once per test file: an instance takes about a second.
import { NodeServices } from "@effect/platform-node";
import { PgliteClient, PgliteMigrator } from "@effect/sql-pglite";
import { Layer, String } from "effect";

import { migrationsDirectory } from "#/database/migration-files.ts";

export const TestDatabase = PgliteMigrator.layer({
  loader: PgliteMigrator.fromFileSystem(migrationsDirectory),
}).pipe(
  Layer.provideMerge(
    PgliteClient.layer({
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    }),
  ),
  Layer.provide(NodeServices.layer),
  Layer.orDie,
);
