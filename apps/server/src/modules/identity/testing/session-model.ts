import { setup, types } from "xstate/fsm";
import { getAdjacencyMap } from "xstate/graph";

import { coveringWalks, takesEvent } from "#/modules/testing/index.ts";

/** What the User got for the last event. */
type Answer = "ok" | "refused" | "mailed" | "notMailed" | null;

/** The last Password Reset link mailed to the User: none yet, one that still sets a password, or a spent one. */
type Link = "none" | "live" | "dead";

/**
 * One User in one browser (`docs/identity.md`, `docs/password-reset.md`): whether the browser's Session lets them
 * in, as an Admin suspends them and lets them back in, and as they reset their password. A model to walk against
 * the `Api`, not code the server runs.
 *
 * What it leaves out: one browser at a time, a Session's 30 days and its extension, forged links and unknown emails
 * (other tests have them), and the attempt limits, raised out of reach. Time passes only as a link's hour.
 */
const sessionModel = setup({
  schemas: {
    context: types<{
      readonly link: Link;
      /** The User holds a link a later one replaced: it sets nothing. */
      readonly holdsReplacedLink: boolean;
      /** The User reset their password once at least: the former one signs no one in. */
      readonly hasFormerPassword: boolean;
      // What the last event got, not state. An FSM has no state input to carry it, so it is context, and the
      // walks' key leaves it out.
      readonly answer: Answer;
    }>(),
    events: {
      signIn: types<{}>(),
      signInWithFormerPassword: types<{}>(),
      signOut: types<{}>(),
      suspend: types<{}>(),
      reactivate: types<{}>(),
      requestReset: types<{}>(),
      /** With the last link mailed. */
      confirmReset: types<{}>(),
      /** With the link the last one replaced. */
      confirmReplacedLink: types<{}>(),
      /** The link's hour passes, far within a Session's. */
      waitAnHour: types<{}>(),
    },
  },
}).createFSM({
  initial: "signedOut",
  context: { link: "none", holdsReplacedLink: false, hasFormerPassword: false, answer: null },
  states: {
    signedOut: {
      on: {
        signIn: { target: "signedIn", context: { answer: "ok" } },
        signInWithFormerPassword: { target: "signedOut", context: { answer: "refused" } },
        suspend: { target: "suspended", context: { answer: "ok" } },
        // Asking again makes the earlier link useless.
        requestReset: ({ context }) => ({
          target: "signedOut",
          context: { link: "live", holdsReplacedLink: context.link !== "none", answer: "mailed" },
        }),
        confirmReset: ({ context }) =>
          context.link === "live"
            ? {
                target: "signedOut",
                context: { link: "dead", hasFormerPassword: true, answer: "ok" },
              }
            : { target: "signedOut", context: { answer: "refused" } },
        confirmReplacedLink: { target: "signedOut", context: { answer: "refused" } },
        waitAnHour: { target: "signedOut", context: { link: "dead", answer: "ok" } },
      },
    },
    signedIn: {
      on: {
        signIn: { target: "signedIn", context: { answer: "ok" } },
        signInWithFormerPassword: { target: "signedIn", context: { answer: "refused" } },
        signOut: { target: "signedOut", context: { answer: "ok" } },
        // The Session ends at its next request.
        suspend: { target: "suspended", context: { answer: "ok" } },
        requestReset: ({ context }) => ({
          target: "signedIn",
          context: { link: "live", holdsReplacedLink: context.link !== "none", answer: "mailed" },
        }),
        // A new password ends every Session of the User.
        confirmReset: ({ context }) =>
          context.link === "live"
            ? {
                target: "signedOut",
                context: { link: "dead", hasFormerPassword: true, answer: "ok" },
              }
            : { target: "signedIn", context: { answer: "refused" } },
        confirmReplacedLink: { target: "signedIn", context: { answer: "refused" } },
        waitAnHour: { target: "signedIn", context: { link: "dead", answer: "ok" } },
      },
    },
    suspended: {
      on: {
        signIn: { target: "suspended", context: { answer: "refused" } },
        signInWithFormerPassword: { target: "suspended", context: { answer: "refused" } },
        reactivate: { target: "signedOut", context: { answer: "ok" } },
        requestReset: { target: "suspended", context: { answer: "notMailed" } },
        // Refused as a stranger's, and spent all the same.
        confirmReset: { target: "suspended", context: { link: "dead", answer: "refused" } },
        confirmReplacedLink: { target: "suspended", context: { answer: "refused" } },
        waitAnHour: { target: "suspended", context: { link: "dead", answer: "ok" } },
      },
    },
  },
});

type SessionModelState = typeof sessionModel.initialState;

type SessionModelEvent = Parameters<typeof sessionModel.transition>[1];

const keyOf = ({ value, context: { answer: _, ...context } }: SessionModelState) =>
  JSON.stringify([value, context]);

/**
 * The User presents only a link or a password they hold, and an hour passes only while a link is live: otherwise it
 * changes nothing the model tells apart.
 */
const holds = ({ context }: SessionModelState, { type }: SessionModelEvent) => {
  switch (type) {
    case "signInWithFormerPassword":
      return context.hasFormerPassword;
    case "confirmReset":
      return context.link !== "none";
    case "confirmReplacedLink":
      return context.holdsReplacedLink;
    case "waitAnHour":
      return context.link === "live";
    default:
      return true;
  }
};

const canSend = (snapshot: SessionModelState, event: SessionModelEvent) =>
  takesEvent(sessionModel, snapshot, event) && holds(snapshot, event);

export const sessionModelWalks = coveringWalks(
  getAdjacencyMap(sessionModel, {
    events: [
      { type: "signIn" },
      { type: "signInWithFormerPassword" },
      { type: "signOut" },
      { type: "suspend" },
      { type: "reactivate" },
      { type: "requestReset" },
      { type: "confirmReset" },
      { type: "confirmReplacedLink" },
      { type: "waitAnHour" },
    ],
    filterEvents: canSend,
    serializeState: keyOf,
  }),
  sessionModel.initialState,
  keyOf,
);
