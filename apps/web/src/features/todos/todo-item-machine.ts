import { setup, types } from "xstate/fsm";

// `failedTo` belongs to `failed`: the other states have none, so the transitions out of it clear it, since a patch
// keeps every field it does not set.
const notFailed = { schemas: { context: types<{ failedTo?: undefined }>() } };

/**
 * A todo's row, one request at a time: completing it or removing it, and the failure of the last one, which the next
 * request clears.
 */
export const todoItemMachine = setup({
  schemas: {
    events: {
      complete: types<{}>(),
      remove: types<{}>(),
      succeeded: types<{}>(),
      failed: types<{}>(),
    },
  },
  states: {
    idle: notFailed,
    completing: notFailed,
    removing: notFailed,
    failed: { schemas: { context: types<{ failedTo: "complete" | "remove" }>() } },
  },
}).createFSM({
  initial: "idle",
  context: {},
  states: {
    idle: {
      on: { complete: { target: "completing" }, remove: { target: "removing" } },
    },
    completing: {
      on: {
        succeeded: { target: "idle" },
        failed: { target: "failed", context: { failedTo: "complete" } },
      },
    },
    removing: {
      on: {
        succeeded: { target: "idle" },
        failed: { target: "failed", context: { failedTo: "remove" } },
      },
    },
    failed: {
      on: {
        complete: { target: "completing", context: { failedTo: undefined } },
        remove: { target: "removing", context: { failedTo: undefined } },
      },
    },
  },
});
