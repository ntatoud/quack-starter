import { setup, types } from "xstate/fsm";
import { getAdjacencyMap } from "xstate/graph";

import { coveringWalks } from "#/modules/identity/testing/model-walks.ts";

/** What the User got for the last event. */
type Answer = "ok" | "refused" | "mailed" | "notMailed" | null;

/**
 * One User in one browser (`docs/identity.md`, `docs/password-reset.md`): whether the browser's Session lets them
 * in, as an Admin suspends them and lets them back in, and as they reset their password. A model to walk against
 * the `Api`, not code the server runs.
 */
const sessionModel = setup({
  schemas: {
    context: types<{
      /** The last Password Reset link mailed to the User still sets a password. */
      readonly liveLink: boolean;
      readonly answer: Answer;
    }>(),
    events: {
      signIn: types<{}>(),
      /** With a password that is not theirs: a former one, when they have one. */
      signInWithWrongPassword: types<{}>(),
      signOut: types<{}>(),
      suspend: types<{}>(),
      reactivate: types<{}>(),
      requestReset: types<{}>(),
      /** With the last link mailed, or a forged one when none was. */
      confirmReset: types<{}>(),
      /** With a link a later one replaced, or a forged one when none was. */
      confirmUnknownLink: types<{}>(),
      /** The link's hour passes, far within a Session's. */
      waitAnHour: types<{}>(),
    },
  },
}).createFSM({
  initial: "signedOut",
  context: { liveLink: false, answer: null },
  states: {
    signedOut: {
      on: {
        signIn: { target: "signedIn", context: { answer: "ok" } },
        signInWithWrongPassword: { context: { answer: "refused" } },
        suspend: { target: "suspended", context: { answer: "ok" } },
        requestReset: { context: { liveLink: true, answer: "mailed" } },
        confirmReset: ({ context }) =>
          context.liveLink
            ? { context: { liveLink: false, answer: "ok" } }
            : { context: { answer: "refused" } },
        confirmUnknownLink: { context: { answer: "refused" } },
        waitAnHour: { context: { liveLink: false, answer: "ok" } },
      },
    },
    signedIn: {
      on: {
        signIn: { context: { answer: "ok" } },
        signInWithWrongPassword: { context: { answer: "refused" } },
        signOut: { target: "signedOut", context: { answer: "ok" } },
        // The Session ends at its next request.
        suspend: { target: "suspended", context: { answer: "ok" } },
        requestReset: { context: { liveLink: true, answer: "mailed" } },
        // A new password ends every Session of the User.
        confirmReset: ({ context }) =>
          context.liveLink
            ? { target: "signedOut", context: { liveLink: false, answer: "ok" } }
            : { context: { answer: "refused" } },
        confirmUnknownLink: { context: { answer: "refused" } },
        waitAnHour: { context: { liveLink: false, answer: "ok" } },
      },
    },
    suspended: {
      on: {
        signIn: { context: { answer: "refused" } },
        signInWithWrongPassword: { context: { answer: "refused" } },
        reactivate: { target: "signedOut", context: { answer: "ok" } },
        requestReset: { context: { answer: "notMailed" } },
        // Refused as a stranger's, and spent all the same.
        confirmReset: { context: { liveLink: false, answer: "refused" } },
        confirmUnknownLink: { context: { answer: "refused" } },
        waitAnHour: { context: { liveLink: false, answer: "ok" } },
      },
    },
  },
});

type SessionModelState = typeof sessionModel.initialState;

type SessionModelEvent = Parameters<typeof sessionModel.transition>[1];

// The answer says how a state was reached, not what it does next: two states that differ by it only are one.
const keyOf = ({ value, context: { answer: _, ...context } }: SessionModelState) =>
  JSON.stringify([value, context]);

/** The FSM keeps its snapshot on an event its state does not take: the walk sends none of those. */
const isTaken = ({ value }: SessionModelState, { type }: SessionModelEvent) =>
  Object.hasOwn(sessionModel.config.states[value].on ?? {}, type);

/** An hour passes only while a link is live: otherwise it changes nothing the model tells apart. */
const canSend = (state: SessionModelState, event: SessionModelEvent) =>
  isTaken(state, event) && (event.type !== "waitAnHour" || state.context.liveLink);

export const sessionModelWalks = coveringWalks(
  getAdjacencyMap(sessionModel, {
    events: [
      { type: "signIn" },
      { type: "signInWithWrongPassword" },
      { type: "signOut" },
      { type: "suspend" },
      { type: "reactivate" },
      { type: "requestReset" },
      { type: "confirmReset" },
      { type: "confirmUnknownLink" },
      { type: "waitAnHour" },
    ],
    filterEvents: canSend,
    serializeState: keyOf,
  }),
  sessionModel.initialState,
  keyOf,
);
