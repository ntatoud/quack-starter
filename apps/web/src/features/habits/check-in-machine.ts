import { setup, types } from "xstate/fsm";

// `failedTo` belongs to `failed`: the other states have none, so the transitions out of it clear it, since a patch
// keeps every field it does not set.
const notFailed = { schemas: { context: types<{ failedTo?: undefined }>() } };

/**
 * A Habit's check on Today, one request at a time: checking it in or unchecking it, which the row shows at once, and
 * the failure of the last one, which the next request clears.
 */
export const checkInMachine = setup({
  schemas: {
    events: {
      check: types<{}>(),
      uncheck: types<{}>(),
      succeeded: types<{}>(),
      failed: types<{}>(),
    },
  },
  states: {
    idle: notFailed,
    checking: notFailed,
    unchecking: notFailed,
    failed: { schemas: { context: types<{ failedTo: "check" | "uncheck" }>() } },
  },
}).createFSM({
  initial: "idle",
  context: {},
  states: {
    idle: {
      on: { check: { target: "checking" }, uncheck: { target: "unchecking" } },
    },
    checking: {
      on: {
        succeeded: { target: "idle" },
        failed: { target: "failed", context: { failedTo: "check" } },
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
        check: { target: "checking", context: { failedTo: undefined } },
        uncheck: { target: "unchecking", context: { failedTo: undefined } },
      },
    },
  },
});
