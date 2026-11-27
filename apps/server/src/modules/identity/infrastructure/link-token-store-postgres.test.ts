import { Effect, Layer } from "effect";

import { LinkTokenStorePostgres } from "#/modules/identity/infrastructure/link-token-store-postgres.ts";
import { linkTokenStoreSuite } from "#/modules/identity/testing/link-token-store-suite.ts";
import { aUser, TestDatabase } from "#/modules/testing/index.ts";

linkTokenStoreSuite(
  LinkTokenStorePostgres.pipe(Layer.provideMerge(TestDatabase)),
  Effect.map(aUser(), ({ id }) => id),
);
