import { NodeServices } from "@effect/platform-node";
import { PgliteClient, PgliteMigrator } from "@effect/sql-pglite";
import { Layer, String } from "effect";

import { migrationsDirectory } from "#/database/migration-files.ts";

/**
 * Postgres in the process, migrated, for the tests of code that only runs on Postgres: Yielded Auth stores its
 * credentials and Sessions there, and has no memory adapter for a sign-up. Each build is a new, empty database.
 */
export const PgliteDatabase = PgliteMigrator.layer({
  loader: PgliteMigrator.fromFileSystem(migrationsDirectory),
}).pipe(
  Layer.provideMerge(
    PgliteClient.layer({
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
      // `int8` as `bigint`, as the driver of production gives it.
      parsers: { 20: BigInt },
    }),
  ),
  Layer.provide(NodeServices.layer),
  Layer.orDie,
);
