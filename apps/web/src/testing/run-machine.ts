import type { AnyActorLogic, EventFromLogic, SnapshotFrom } from "xstate";
import { getShortestPaths } from "xstate/graph";

/** The snapshot `machine` reaches from its initial one through `events`. */
export const runMachine = <TSnapshot, TEvent>(
  machine: {
    readonly initialState: TSnapshot;
    transition(snapshot: TSnapshot, event: TEvent): readonly [TSnapshot, ReadonlyArray<unknown>];
  },
  ...events: ReadonlyArray<TEvent>
): TSnapshot =>
  events.reduce((snapshot, event) => machine.transition(snapshot, event)[0], machine.initialState);

/**
 * Every snapshot `machine` reaches by sending `events` in any order: an exploration bounded by these events, not a
 * proof over every payload. A Set is told apart by its items, which JSON alone would write as `{}`.
 */
export const reachableSnapshots = <TLogic extends AnyActorLogic>(
  machine: TLogic,
  events: ReadonlyArray<EventFromLogic<TLogic>>,
): ReadonlyArray<SnapshotFrom<TLogic>> =>
  getShortestPaths(machine, {
    events,
    serializeState: (snapshot) =>
      JSON.stringify(snapshot, (_, value) => (value instanceof Set ? [...value] : value)),
  }).map((path) => path.state);
