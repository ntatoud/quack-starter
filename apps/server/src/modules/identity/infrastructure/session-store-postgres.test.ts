import { Effect, Layer } from "effect";

import { SessionStorePostgres } from "#/modules/identity/infrastructure/session-store-postgres.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";
import { sessionStoreSuite } from "#/modules/identity/testing/session-store-suite.ts";
import { aUser, TestDatabase } from "#/modules/testing/index.ts";

sessionStoreSuite(
  Layer.mergeAll(SessionStorePostgres, UserRepositoryPostgres).pipe(Layer.provide(TestDatabase)),
  Effect.map(aUser(), ({ id }) => id),
);
