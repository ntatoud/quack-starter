import { Layer, Redacted } from "effect";
import { describe } from "vite-plus/test";

import { databaseAt } from "#/database/database.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";
import { userRepositorySuite } from "#/modules/identity/testing/user-repository-suite.ts";

// A database of its own, which these tests migrate and fill: never one a server uses.
const url = process.env.TEST_DATABASE_URL;

const Postgres = UserRepositoryPostgres.pipe(
  Layer.provide(databaseAt({ url: Redacted.make(url ?? ""), maxConnections: 2 })),
  Layer.orDie,
);

describe.skipIf(url === undefined)("UserRepositoryPostgres", () => {
  userRepositorySuite(Postgres);
});
