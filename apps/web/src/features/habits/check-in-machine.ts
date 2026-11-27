import { setup, types } from "xstate/fsm";

// `failedTo` belongs to `failed` and `quantity` to `checking`: the other states have neither, so the transitions out
// of them clear it, since a patch keeps every field it does not set.
const settled = { schemas: { context: types<{ failedTo?: undefined; quantity?: undefined }>() } };

/**
 * A Habit's Check-in on Today, one request at a time: checking it in, with the Day's total for a quantity Habit, or
 * unchecking it, which the row shows at once, and the failure of the last one, which the next request clears.
 */
export const checkInMachine = setup({
  schemas: {
    events: {
      check: types<{ quantity: number | null }>(),
      uncheck: types<{}>(),
      succeeded: types<{}>(),
      failed: types<{}>(),
    },
  },
  states: {
    idle: settled,
    checking: {
      schemas: { context: types<{ failedTo?: undefined; quantity: number | null }>() },
    },
    unchecking: settled,
    failed: {
      schemas: { context: types<{ failedTo: "check" | "uncheck"; quantity?: undefined }>() },
    },
  },
}).createFSM({
  initial: "idle",
  context: {},
  states: {
    idle: {
      on: {
        check: ({ event }) => ({ target: "checking", context: { quantity: event.quantity } }),
        uncheck: { target: "unchecking" },
      },
    },
    checking: {
      on: {
        succeeded: { target: "idle", context: { quantity: undefined } },
        failed: { target: "failed", context: { failedTo: "check", quantity: undefined } },
      },
    },
    unchecking: {
      on: {
        succeeded: { target: "idle" },
        failed: { target: "failed", context: { failedTo: "uncheck" } },
      },
    },
    failed: {
      on: {
        check: ({ event }) => ({
          target: "checking",
          context: { failedTo: undefined, quantity: event.quantity },
        }),
        uncheck: { target: "unchecking", context: { failedTo: undefined } },
      },
    },
  },
});
