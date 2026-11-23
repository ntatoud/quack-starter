import { setup, types } from "xstate/fsm";

// A state without a context schema has any context, which a transition from a state with one would have to patch.
const noContext = { schemas: { context: types<{}>() } };

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
    idle: noContext,
    completing: noContext,
    removing: noContext,
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
      on: { complete: { target: "completing" }, remove: { target: "removing" } },
    },
  },
});
