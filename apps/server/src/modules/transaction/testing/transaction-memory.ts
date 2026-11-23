import { Layer } from "effect";

import { Transaction } from "#/modules/transaction/domain/transaction.ts";

// The memory stores change in one synchronous step each, and lose everything with the process anyway.
export const TransactionMemory = Layer.succeed(
  Transaction,
  Transaction.of({ run: (effect) => effect }),
);
