import type { AdjacencyMap } from "xstate/graph";

export interface ModelStep<TSnapshot, TEvent> {
  readonly event: TEvent;
  /** What the model expects once the event is handled. */
  readonly state: TSnapshot;
}

/**
 * Whether the table of an FSM has a transition for `event` in the state of `snapshot`. The FSM answers any other event
 * with the same snapshot, which `xstate/graph` takes for a transition back to the state: pass this to `filterEvents`.
 */
export const takesEvent = (
  fsm: { readonly config: { readonly states: Readonly<Record<string, { readonly on?: object }>> } },
  snapshot: { readonly value: string },
  event: { readonly type: string },
) => Object.hasOwn(fsm.config.states[snapshot.value]?.on ?? {}, event.type);

/**
 * Walks from the initial state of a model that together take each of its transitions once at least. A walk goes on to
 * the nearest transition not taken yet, and a new walk starts from the initial state when none is left within reach:
 * fewer walks than one per transition, each of them a fresh start of the system the model stands for.
 *
 * `keyOf` must be the `serializeState` the adjacency map was built with.
 */
export const coveringWalks = <TSnapshot, TEvent>(
  adjacency: AdjacencyMap<TSnapshot, TEvent>,
  initial: TSnapshot,
  keyOf: (snapshot: TSnapshot) => string,
): ReadonlyArray<ReadonlyArray<ModelStep<TSnapshot, TEvent>>> => {
  const transitionsOf = (key: string) =>
    Object.entries(adjacency[key as keyof typeof adjacency]?.transitions ?? {});

  const untaken = new Set(
    Object.keys(adjacency).flatMap((key) =>
      transitionsOf(key).map(([eventKey]) => `${key} ${eventKey}`),
    ),
  );

  /** The steps from `from` to, and through, the nearest transition not taken yet. */
  const routeToUntaken = (from: string) => {
    const routes = new Map<string, ReadonlyArray<ModelStep<TSnapshot, TEvent>>>([[from, []]]);
    const queue = [from];

    for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
      const route = routes.get(key) ?? [];

      for (const [eventKey, { event, state }] of transitionsOf(key)) {
        if (untaken.has(`${key} ${eventKey}`)) return [...route, { event, state }];
      }

      for (const [, { event, state }] of transitionsOf(key)) {
        const next = keyOf(state);

        if (!routes.has(next)) {
          routes.set(next, [...route, { event, state }]);
          queue.push(next);
        }
      }
    }

    return undefined;
  };

  const walks: Array<ReadonlyArray<ModelStep<TSnapshot, TEvent>>> = [];

  while (untaken.size > 0) {
    const walk: Array<ModelStep<TSnapshot, TEvent>> = [];
    let at = keyOf(initial);

    for (let route = routeToUntaken(at); route !== undefined; route = routeToUntaken(at)) {
      for (const step of route) {
        const eventKey = transitionsOf(at).find(
          ([, transition]) => transition.event === step.event,
        )?.[0];

        untaken.delete(`${at} ${eventKey}`);
        at = keyOf(step.state);
      }

      walk.push(...route);
    }

    // Every transition of the map is reachable from the initial state, which the map was built from.
    if (walk.length === 0) throw new Error(`Transitions out of reach: ${[...untaken].join(", ")}`);
    walks.push(walk);
  }

  return walks;
};
