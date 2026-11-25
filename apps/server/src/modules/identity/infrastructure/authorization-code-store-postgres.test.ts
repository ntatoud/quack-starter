import { Layer, Redacted } from "effect";
import { describe } from "vite-plus/test";

import { databaseAt } from "#/database/database.ts";
import { aStoredUser } from "#/database/testing/a-stored-user.ts";
import { AuthorizationCodeStorePostgres } from "#/modules/identity/infrastructure/authorization-code-store-postgres.ts";
import { authorizationCodeStoreSuite } from "#/modules/identity/testing/authorization-code-store-suite.ts";

// A database of its own, which these tests migrate and fill: never one a server uses.
const url = process.env.TEST_DATABASE_URL;

const Postgres = AuthorizationCodeStorePostgres.pipe(
  Layer.provideMerge(databaseAt({ url: Redacted.make(url ?? ""), maxConnections: 2 })),
  Layer.orDie,
);

describe.skipIf(url === undefined)("AuthorizationCodeStorePostgres", () => {
  authorizationCodeStoreSuite(Postgres, aStoredUser);
});
