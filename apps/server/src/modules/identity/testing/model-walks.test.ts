import { describe, expect, it } from "vite-plus/test";
import { createFSM } from "xstate/fsm";
import { adjacencyMapToArray, getAdjacencyMap } from "xstate/graph";

import { coveringWalks } from "#/modules/identity/testing/model-walks.ts";

type Event = { readonly type: "open" } | { readonly type: "close" } | { readonly type: "lock" };

const door = createFSM<{}, Event>({
  initial: "closed",
  states: {
    closed: { on: { open: { target: "opened" }, lock: { target: "locked" } } },
    opened: { on: { close: { target: "closed" } } },
    locked: {},
  },
});

const keyOf = (snapshot: typeof door.initialState) => snapshot.value;

const adjacency = getAdjacencyMap(door, {
  events: [{ type: "open" }, { type: "close" }, { type: "lock" }],
  filterEvents: ({ value }, { type }) => Object.hasOwn(door.config.states[value]?.on ?? {}, type),
  serializeState: keyOf,
});

describe("coveringWalks", () => {
  const walks = coveringWalks(adjacency, door.initialState, keyOf);

  it("takes every transition, each walk from the initial state", () => {
    const taken = new Set<string>();

    for (const walk of walks) {
      let at = "closed";

      for (const { event, state } of walk) {
        expect(door.transition({ ...door.initialState, value: at }, event)[0]).toEqual(state);
        taken.add(`${at} ${event.type}`);
        at = state.value;
      }
    }

    expect([...taken].toSorted()).toEqual(
      adjacencyMapToArray(adjacency)
        .map(({ state, event }) => `${state.value} ${event.type}`)
        .toSorted(),
    );
  });

  it("starts a walk again only when no transition left is within reach", () => {
    expect(walks.map((walk) => walk.map(({ event }) => event.type))).toEqual([
      ["open", "close", "lock"],
    ]);
  });
});
