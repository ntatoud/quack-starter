import { setup, types } from "xstate/fsm";
import { getAdjacencyMap } from "xstate/graph";

import { coveringWalks } from "#/modules/identity/testing/model-walks.ts";

/** What the AI Client got for the last event: tokens or a refusal. */
type Answer = "ok" | "refused" | null;

/**
 * The Grant of a User to one AI Client, as the AI Client and the User see it (`docs/ai-clients.md`): which of its
 * tokens open `/api/mcp`, and whether the User's settings list it. A model to walk against the `Api`, not code
 * the server runs.
 */
const grantModel = setup({
  schemas: {
    context: types<{
      /** The AI Client holds an access and a refresh token, live or not. */
      readonly holdsTokens: boolean;
      /** It holds a refresh token it already traded. */
      readonly holdsReplaced: boolean;
      /** That traded token is of the Grant as it is now: presenting it again shows a thief. */
      readonly replacedOfGrant: boolean;
      readonly answer: Answer;
    }>(),
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
}).createFSM({
  initial: "none",
  context: { holdsTokens: false, holdsReplaced: false, replacedOfGrant: false, answer: null },
  states: {
    none: {
      on: {
        approve: { target: "granted", context: { holdsTokens: true, answer: "ok" } },
        refresh: { context: { answer: "refused" } },
        replay: { context: { answer: "refused" } },
      },
    },
    granted: {
      on: {
        // The Grant's earlier tokens are revoked: the one traded is unknown from then on.
        approve: { context: { replacedOfGrant: false, answer: "ok" } },
        refresh: { context: { holdsReplaced: true, replacedOfGrant: true, answer: "ok" } },
        replay: ({ context }) =>
          context.replacedOfGrant
            ? { target: "none", context: { replacedOfGrant: false, answer: "refused" } }
            : { context: { answer: "refused" } },
        revoke: { target: "none", context: { replacedOfGrant: false, answer: "ok" } },
        expire: { target: "none", context: { replacedOfGrant: false, answer: "ok" } },
      },
    },
  },
});

type GrantModelState = typeof grantModel.initialState;

type GrantModelEvent = Parameters<typeof grantModel.transition>[1];

// The answer says how a state was reached, not what it does next: two states that differ by it only are one.
const keyOf = ({ value, context: { answer: _, ...context } }: GrantModelState) =>
  JSON.stringify([value, context]);

/** Events the AI Client or the User can send: a refresh needs a token, and a revocation a Grant listed. */
const canSend = ({ value, context }: GrantModelState, { type }: GrantModelEvent) => {
  switch (type) {
    case "refresh":
      return context.holdsTokens;
    case "replay":
      return context.holdsReplaced;
    case "revoke":
    case "expire":
      return value === "granted";
    case "approve":
      return true;
  }
};

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
