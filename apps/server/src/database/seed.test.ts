import { assert, describe, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";

import { databaseAt } from "#/database/database.ts";
import { isLocalDatabaseUrl, NotLocalDatabase, seedDatabase } from "#/database/seed.ts";
import { testDatabaseUrl } from "#/modules/testing/index.ts";

describe("isLocalDatabaseUrl", () => {
  it("accepts a database on localhost or 127.0.0.1", () => {
    assert.isTrue(isLocalDatabaseUrl("postgres://quack:quack@127.0.0.1:54320/quack"));
    assert.isTrue(isLocalDatabaseUrl("postgresql://quack@localhost/quack_feat_x"));
  });

  it("refuses any other host, and what is not a postgres URL", () => {
    assert.isFalse(isLocalDatabaseUrl("postgres://quack:s3cret@db.example:5432/quack"));
    assert.isFalse(isLocalDatabaseUrl("postgres://quack@localhost.example.com/quack"));
    assert.isFalse(isLocalDatabaseUrl("postgres://quack@10.0.0.1/quack"));
    assert.isFalse(isLocalDatabaseUrl("postgres:///quack?host=db.example"));
    assert.isFalse(isLocalDatabaseUrl("http://localhost/quack"));
    assert.isFalse(isLocalDatabaseUrl("localhost"));
  });
});

describe("seedDatabase", () => {
  it.effect(
    "refuses a database that is not local, with its password masked, connecting to nothing",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          seedDatabase({
            url: Redacted.make("postgres://quack:s3cret@db.example:5432/quack"),
            maxConnections: 1,
          }),
        );

        assert.instanceOf(error, NotLocalDatabase);
        assert.strictEqual(
          error.message,
          "pnpm db:seed resets the database, so it runs on localhost or 127.0.0.1 only, not on postgres://quack:***@db.example:5432/quack.",
        );
      }),
  );
});

// Read as the web app would show them: each dev account's Todos, oldest first.
const seededTodos = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  return yield* sql<{
    readonly email: string;
    readonly title: string;
    readonly completed: boolean;
  }>`
    SELECT users.email, todos.title, todos.completed
    FROM todos JOIN users ON users.id = todos.owner_id
    ORDER BY users.email, todos.created_at, todos.id`;
});

const draftsOf = (email: string) => [
  { email, title: "Read the README", completed: true },
  { email, title: "Start Postgres with pnpm dev", completed: true },
  { email, title: "Add a module, copied from todos", completed: false },
  { email, title: "Rebrand the app in @quack/brand", completed: false },
  { email, title: "Deploy the app", completed: false },
];

describe("seedDatabase on a local database", () => {
  // The seed spaces its Todos on the real clock, which orders them.
  it.live(
    "gives each dev account its Todos through the Api, some completed, and the same again at every run",
    () =>
      Effect.gen(function* () {
        const config = { url: Redacted.make(yield* testDatabaseUrl), maxConnections: 1 };
        const expected = [...draftsOf("admin@quack.dev"), ...draftsOf("user@quack.dev")];

        yield* seedDatabase(config);
        const once = yield* seededTodos.pipe(Effect.provide(databaseAt(config)));
        yield* seedDatabase(config);
        const twice = yield* seededTodos.pipe(Effect.provide(databaseAt(config)));

        assert.deepStrictEqual(once, expected);
        assert.deepStrictEqual(twice, expected);
      }).pipe(Effect.scoped),
  );
});
