import { Context, type Effect } from "effect";

/**
 * Runs an effect as one unit of storage: its writes are all kept, or none, and a row it takes stays held from
 * other runs until it ends.
 */
export class Transaction extends Context.Service<
  Transaction,
  {
    run<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R>;
  }
>()("@quack/server/transaction/Transaction") {}
