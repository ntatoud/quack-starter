import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { describe } from "vite-plus/test";

import { TestDatabase } from "#/modules/testing/index.ts";
import { Transaction } from "#/modules/transaction/domain/transaction.ts";
import { TransactionPostgres } from "#/modules/transaction/infrastructure/transaction-postgres.ts";

const Postgres = TransactionPostgres.pipe(Layer.provideMerge(TestDatabase));

const rowsAfter = (run: (insert: Effect.Effect<unknown>) => Effect.Effect<unknown, string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const id = crypto.randomUUID();

    yield* sql`CREATE TABLE transaction_runs (id text)`;

    yield* (yield* Transaction)
      .run(run(sql`INSERT INTO transaction_runs (id) VALUES (${id})`.pipe(Effect.orDie)))
      .pipe(Effect.ignore);

    return yield* sql`SELECT id FROM transaction_runs WHERE id = ${id}`;
  }).pipe(Effect.orDie, Effect.provide(Postgres));

describe("TransactionPostgres", () => {
  it.effect("keeps the writes of a run that succeeds", () =>
    Effect.gen(function* () {
      assert.lengthOf(yield* rowsAfter((insert) => insert), 1);
    }),
  );

  it.effect("drops the writes of a run that fails", () =>
    Effect.gen(function* () {
      assert.lengthOf(
        yield* rowsAfter((insert) => Effect.andThen(insert, Effect.fail("halfway"))),
        0,
      );
    }),
  );
});
