import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { isSqlError } from "effect/sql/SqlError";

import { Transaction } from "#/modules/transaction/domain/transaction.ts";

export const TransactionPostgres = Layer.effect(
  Transaction,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return Transaction.of({
      run: (effect) => sql.withTransaction(effect).pipe(Effect.catchIf(isSqlError, Effect.die)),
    });
  }),
);
