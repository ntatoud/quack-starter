import { Layer, Redacted } from "effect";
import { describe } from "vite-plus/test";

import { databaseAt } from "#/database/database.ts";
import { aStoredUser } from "#/database/testing/a-stored-user.ts";
import { SessionStorePostgres } from "#/modules/identity/infrastructure/session-store-postgres.ts";
import { sessionStoreSuite } from "#/modules/identity/testing/session-store-suite.ts";

// A database of its own, which these tests migrate and fill: never one a server uses.
const url = process.env.TEST_DATABASE_URL;

const Postgres = SessionStorePostgres.pipe(
  Layer.provideMerge(databaseAt({ url: Redacted.make(url ?? ""), maxConnections: 2 })),
  Layer.orDie,
);

describe.skipIf(url === undefined)("SessionStorePostgres", () => {
  sessionStoreSuite(Postgres, aStoredUser);
});
