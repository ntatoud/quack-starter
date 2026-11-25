import { Layer, Redacted } from "effect";
import { describe } from "vite-plus/test";

import { databaseAt } from "#/database/database.ts";
import { aStoredUser } from "#/database/testing/a-stored-user.ts";
import { TodoRepositoryPostgres } from "#/modules/todos/infrastructure/todo-repository-postgres.ts";
import { todoRepositorySuite } from "#/modules/todos/testing/todo-repository-suite.ts";

// A database of its own, which these tests migrate and fill: never one a server uses.
const url = process.env.TEST_DATABASE_URL;

const Postgres = TodoRepositoryPostgres.pipe(
  Layer.provideMerge(databaseAt({ url: Redacted.make(url ?? ""), maxConnections: 2 })),
  Layer.orDie,
);

describe.skipIf(url === undefined)("TodoRepositoryPostgres", () => {
  todoRepositorySuite(Postgres, aStoredUser);
});
