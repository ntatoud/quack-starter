import { Effect, Layer } from "effect";

import { SessionStorePostgres } from "#/modules/identity/infrastructure/session-store-postgres.ts";
import { sessionStoreSuite } from "#/modules/identity/testing/session-store-suite.ts";
import { aUser, TestDatabase } from "#/modules/testing/index.ts";

sessionStoreSuite(
  SessionStorePostgres.pipe(Layer.provideMerge(TestDatabase)),
  Effect.map(aUser(), ({ id }) => id),
);
