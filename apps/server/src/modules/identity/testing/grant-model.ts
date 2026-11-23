import { setup, types } from "xstate/fsm";
import { getAdjacencyMap } from "xstate/graph";

import { coveringWalks, takesEvent } from "#/modules/identity/testing/model-walks.ts";

/** What the AI Client got for the last event: tokens or a refusal. */
type Answer = "ok" | "refused" | null;

/** It holds a refresh token it already traded, of an earlier approval: presenting it again finds nothing. */
const holdsOldTradedToken = {
  schemas: { context: types<{ readonly holdsTradedToken: boolean }>() },
};

/**
 * The Grant of a User to one AI Client, as the AI Client and the User see it (`docs/ai-clients.md`): which of its
 * tokens open `/api/mcp`, and whether the User's settings list it. A model to walk against the `Api`, not code the
 * server runs.
 *
 * What it leaves out: one AI Client and one User at a time, every request asking for the same Permissions, no
 * step-up, no two refreshes at once (the store's compare-and-set decides those), no access token outliving its
 * hour, and time passing only as the Grant's 30 days.
 */
const grantModel = setup({
  schemas: {
    // The answer is what the last event got, not state. An FSM has no state input to carry it, so it is context,
    // and the walks' key leaves it out.
    context: types<{ readonly answer: Answer }>(),
    events: {
      /** The User approves the AI Client, which exchanges the code for tokens. */
      approve: types<{}>(),
      refresh: types<{}>(),
      /** The AI Client presents the refresh token it last traded. */
      replay: types<{}>(),
      /** The User revokes the Grant in their settings. */
      revoke: types<{}>(),
      /** The Grant's 30 days pass. */
      expire: types<{}>(),
    },
  },
  // Once one state declares its context, a transition may target only the states declared here.
  states: { new: {}, granted: holdsOldTradedToken, refreshed: {}, ended: holdsOldTradedToken },
}).createFSM({
  initial: "new",
  context: { answer: null },
  states: {
    /** Never approved: the AI Client holds no token. */
    new: {
      on: { approve: { target: "granted", context: { holdsTradedToken: false, answer: "ok" } } },
    },
    /** Its tokens are live, and it traded none of this approval's. */
    granted: {
      on: {
        approve: { target: "granted", context: { answer: "ok" } },
        refresh: { target: "refreshed", context: { answer: "ok" } },
        replay: { target: "granted", context: { answer: "refused" } },
        revoke: { target: "ended", context: { answer: "ok" } },
        expire: { target: "ended", context: { answer: "ok" } },
      },
    },
    /** Its tokens are live, and it traded one of this approval's: presenting it again shows a thief. */
    refreshed: {
      on: {
        // The Grant's earlier tokens are revoked: the one traded is unknown from then on.
        approve: { target: "granted", context: { holdsTradedToken: true, answer: "ok" } },
        refresh: { target: "refreshed", context: { answer: "ok" } },
        replay: { target: "ended", context: { holdsTradedToken: true, answer: "refused" } },
        revoke: { target: "ended", context: { holdsTradedToken: true, answer: "ok" } },
        expire: { target: "ended", context: { holdsTradedToken: true, answer: "ok" } },
      },
    },
    /** The Grant is revoked or expired: its tokens open nothing. */
    ended: {
      on: {
        approve: { target: "granted", context: { answer: "ok" } },
        refresh: { target: "ended", context: { answer: "refused" } },
        replay: { target: "ended", context: { answer: "refused" } },
      },
    },
  },
});

type GrantModelState = typeof grantModel.initialState;

type GrantModelEvent = Parameters<typeof grantModel.transition>[1];

/** The Grant holds: the settings list it, and the AI Client's last access token opens `/api/mcp`. */
export const isLive = ({ value }: { readonly value: string }) =>
  value === "granted" || value === "refreshed";

// An FSM patches context and never drops a key on leaving a state: the key reads only what the state declares.
const keyOf = (snapshot: GrantModelState) =>
  snapshot.value === "granted" || snapshot.value === "ended"
    ? `${snapshot.value} ${String(snapshot.context.holdsTradedToken)}`
    : snapshot.value;

/** The AI Client presents a traded token only when it holds one. */
const canSend = (snapshot: GrantModelState, event: GrantModelEvent) =>
  takesEvent(grantModel, snapshot, event) &&
  (event.type !== "replay" ||
    snapshot.value === "refreshed" ||
    (snapshot.value !== "new" && snapshot.context.holdsTradedToken));

export const grantModelWalks = coveringWalks(
  getAdjacencyMap(grantModel, {
    events: [
      { type: "approve" },
      { type: "refresh" },
      { type: "replay" },
      { type: "revoke" },
      { type: "expire" },
    ],
    filterEvents: canSend,
    serializeState: keyOf,
  }),
  grantModel.initialState,
  keyOf,
);
