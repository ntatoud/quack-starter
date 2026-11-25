import { setup, types } from "xstate/fsm";
import { getAdjacencyMap } from "xstate/graph";

import { coveringWalks, takesEvent } from "#/modules/identity/testing/model-walks.ts";

/** What the User got for the last event: the tag of the error when the server names one the User sees. */
type Answer = "ok" | "refused" | "WrongPassword" | "EmailAlreadyTaken" | null;

interface Context {
  /** A link was mailed to the User once at least: they hold one to open. */
  readonly holdsLink: boolean;
  /** The User holds a link a later one replaced: it changes nothing. */
  readonly holdsReplacedLink: boolean;
  /** Another User signed up with the new email of the pending link, after it was mailed. */
  readonly newEmailTaken: boolean;
  /** A link changed the User's email once at least: the former one signs no one in. */
  readonly hasFormerEmail: boolean;
  // What the last event got, not state. An FSM has no state input to carry it, so it is context, and the walks'
  // key leaves it out.
  readonly answer: Answer;
}

/** Leaving `pending`: no new email is pending, so none is taken. */
const noLongerPending = { newEmailTaken: false } as const;

/**
 * One signed-in User changing their email (`docs/email-change.md`): whether an email is pending, which email signs
 * them in, as they ask, ask again, cancel, open a link, wait out its 24 hours, and as another User takes the new
 * email meanwhile. A model to walk against the `Api`, not code the server runs.
 *
 * What it leaves out: the Session, which stays open throughout since the password does not change, a suspended
 * User, forged links and links of a Password Reset (other tests have them), and the attempt limit, raised out of
 * reach. Time passes only as a link's 24 hours.
 */
const emailChangeModel = setup({
  schemas: {
    context: types<Context>(),
    events: {
      /** With the current password and an email no User has. */
      request: types<{}>(),
      requestWithWrongPassword: types<{}>(),
      /** With the email of another User. */
      requestTakenEmail: types<{}>(),
      cancel: types<{}>(),
      /** With the last link mailed. */
      confirm: types<{}>(),
      /** With the link the last one replaced. */
      confirmReplacedLink: types<{}>(),
      /** Another User signs up with the pending new email. */
      takeNewEmail: types<{}>(),
      /** The link's 24 hours pass, far within a Session's 30 days. */
      waitADay: types<{}>(),
      /** With the User's current email. */
      signIn: types<{}>(),
      signInWithFormerEmail: types<{}>(),
    },
  },
}).createFSM({
  initial: "idle",
  context: {
    holdsLink: false,
    holdsReplacedLink: false,
    newEmailTaken: false,
    hasFormerEmail: false,
    answer: null,
  },
  states: {
    /** No link works: `me` answers no pending email. */
    idle: {
      on: {
        request: ({ context }) => ({
          target: "pending",
          context: { holdsLink: true, holdsReplacedLink: context.holdsLink, answer: "ok" },
        }),
        requestWithWrongPassword: { target: "idle", context: { answer: "WrongPassword" } },
        requestTakenEmail: { target: "idle", context: { answer: "EmailAlreadyTaken" } },
        cancel: { target: "idle", context: { answer: "ok" } },
        confirm: { target: "idle", context: { answer: "refused" } },
        confirmReplacedLink: { target: "idle", context: { answer: "refused" } },
        signIn: { target: "idle", context: { answer: "ok" } },
        signInWithFormerEmail: { target: "idle", context: { answer: "refused" } },
      },
    },
    /** The last link works: `me` answers its new email as pending, and the User's email is still the former one. */
    pending: {
      on: {
        // Asking again makes the earlier link useless.
        request: {
          target: "pending",
          context: { holdsReplacedLink: true, newEmailTaken: false, answer: "ok" },
        },
        // A refused request leaves the pending link as it was.
        requestWithWrongPassword: { target: "pending", context: { answer: "WrongPassword" } },
        requestTakenEmail: { target: "pending", context: { answer: "EmailAlreadyTaken" } },
        cancel: { target: "idle", context: { ...noLongerPending, answer: "ok" } },
        // A refused link stays spent: the User asks again.
        confirm: ({ context }) =>
          context.newEmailTaken
            ? { target: "idle", context: { ...noLongerPending, answer: "EmailAlreadyTaken" } }
            : {
                target: "idle",
                context: { ...noLongerPending, hasFormerEmail: true, answer: "ok" },
              },
        confirmReplacedLink: { target: "pending", context: { answer: "refused" } },
        takeNewEmail: { target: "pending", context: { newEmailTaken: true, answer: "ok" } },
        waitADay: { target: "idle", context: { ...noLongerPending, answer: "ok" } },
        signIn: { target: "pending", context: { answer: "ok" } },
        signInWithFormerEmail: { target: "pending", context: { answer: "refused" } },
      },
    },
  },
});

type EmailChangeModelState = typeof emailChangeModel.initialState;

type EmailChangeModelEvent = Parameters<typeof emailChangeModel.transition>[1];

const keyOf = ({ value, context: { answer: _, ...context } }: EmailChangeModelState) =>
  JSON.stringify([value, context]);

/**
 * The User presents only a link or an email they hold, and another User takes the new email only once, while it is
 * pending: otherwise it changes nothing the model tells apart.
 */
const holds = ({ value, context }: EmailChangeModelState, { type }: EmailChangeModelEvent) => {
  switch (type) {
    case "confirm":
      return context.holdsLink;
    case "confirmReplacedLink":
      return context.holdsReplacedLink;
    case "signInWithFormerEmail":
      return context.hasFormerEmail;
    case "takeNewEmail":
      return value === "pending" && !context.newEmailTaken;
    default:
      return true;
  }
};

const canSend = (snapshot: EmailChangeModelState, event: EmailChangeModelEvent) =>
  takesEvent(emailChangeModel, snapshot, event) && holds(snapshot, event);

export const emailChangeModelWalks = coveringWalks(
  getAdjacencyMap(emailChangeModel, {
    events: [
      { type: "request" },
      { type: "requestWithWrongPassword" },
      { type: "requestTakenEmail" },
      { type: "cancel" },
      { type: "confirm" },
      { type: "confirmReplacedLink" },
      { type: "takeNewEmail" },
      { type: "waitADay" },
      { type: "signIn" },
      { type: "signInWithFormerEmail" },
    ],
    filterEvents: canSend,
    serializeState: keyOf,
  }),
  emailChangeModel.initialState,
  keyOf,
);
