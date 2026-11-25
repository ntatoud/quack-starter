import { Clock, Layer } from "effect";

import { PgliteDatabase } from "#/database/pglite-database.ts";
import { IdentityPostgres } from "#/modules/identity/index.ts";
import { TransactionPostgres } from "#/modules/transaction/index.ts";

/**
 * Every store of identity, `AppAuth` among them, on a new Postgres in the process: Yielded Auth has no memory
 * adapter for a sign-up, so a test that signs a User up or in runs on this one. The database stays visible.
 */
export const IdentityPglite = Layer.mergeAll(IdentityPostgres, TransactionPostgres).pipe(
  Layer.provideMerge(PgliteDatabase),
  // Yielded keeps the clock it is built with: a TestClock would stand still, and it refuses a Session verified
  // at the instant it was issued.
  Layer.provide(Layer.succeed(Clock.Clock, Clock.Clock.defaultValue())),
);
