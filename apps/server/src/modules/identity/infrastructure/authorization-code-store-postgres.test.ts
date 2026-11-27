import { Effect, Layer } from "effect";

import { AuthorizationCodeStorePostgres } from "#/modules/identity/infrastructure/authorization-code-store-postgres.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";
import { authorizationCodeStoreSuite } from "#/modules/identity/testing/authorization-code-store-suite.ts";
import { aUser, TestDatabase } from "#/modules/testing/index.ts";

authorizationCodeStoreSuite(
  Layer.mergeAll(AuthorizationCodeStorePostgres, UserRepositoryPostgres).pipe(
    Layer.provide(TestDatabase),
  ),
  Effect.map(aUser(), ({ id }) => id),
);
