import { Effect, Layer } from "effect";

import { AuthorizationCodeStorePostgres } from "#/modules/identity/infrastructure/authorization-code-store-postgres.ts";
import { authorizationCodeStoreSuite } from "#/modules/identity/testing/authorization-code-store-suite.ts";
import { aUser, TestDatabase } from "#/modules/testing/index.ts";

authorizationCodeStoreSuite(
  AuthorizationCodeStorePostgres.pipe(Layer.provideMerge(TestDatabase)),
  Effect.map(aUser(), ({ id }) => id),
);
