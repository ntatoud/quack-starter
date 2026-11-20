import { assert, describe, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";

import { isLocalDatabaseUrl, NotLocalDatabase, seedDatabase } from "#/database/seed.ts";

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
