import { setup, types } from "xstate/fsm";

// A state without a context schema has any context, which a transition from a state with one would have to patch.
const noContext = { schemas: { context: types<{}>() } };

/** The actions asked about in a dialog before they run. */
export type Confirmed = "promote" | "suspend" | "delete";

type Asked = { which: Confirmed };

/**
 * The actions on a User, one at a time. A change made at once fails beside the buttons; one confirmed in a dialog
 * fails in it, which stays open until it succeeds.
 */
export const userActionsMachine = setup({
  schemas: {
    events: {
      apply: types<{}>(),
      ask: types<Asked>(),
      dismiss: types<{}>(),
      confirm: types<{}>(),
      succeeded: types<{}>(),
      failed: types<{}>(),
    },
  },
  states: {
    idle: noContext,
    changing: noContext,
    changeFailed: noContext,
    asking: { schemas: { context: types<Asked>() } },
    // Closing while the request runs would hide whether it succeeded: it takes no `dismiss`.
    confirming: { schemas: { context: types<Asked>() } },
    confirmFailed: { schemas: { context: types<Asked>() } },
  },
}).createFSM({
  initial: "idle",
  context: {},
  states: {
    idle: {
      on: {
        apply: { target: "changing" },
        ask: ({ event }) => ({ target: "asking", context: { which: event.which } }),
      },
    },
    changing: {
      on: { succeeded: { target: "idle" }, failed: { target: "changeFailed" } },
    },
    changeFailed: {
      on: {
        apply: { target: "changing" },
        ask: ({ event }) => ({ target: "asking", context: { which: event.which } }),
      },
    },
    asking: {
      on: { confirm: { target: "confirming" }, dismiss: { target: "idle" } },
    },
    confirming: {
      on: { succeeded: { target: "idle" }, failed: { target: "confirmFailed" } },
    },
    confirmFailed: {
      on: { confirm: { target: "confirming" }, dismiss: { target: "idle" } },
    },
  },
});
