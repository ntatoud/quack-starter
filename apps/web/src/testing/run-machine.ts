/** The snapshot `machine` reaches from its initial one through `events`. */
export const runMachine = <TSnapshot, TEvent>(
  machine: {
    readonly initialState: TSnapshot;
    transition(snapshot: TSnapshot, event: TEvent): readonly [TSnapshot, ReadonlyArray<unknown>];
  },
  ...events: ReadonlyArray<TEvent>
): TSnapshot =>
  events.reduce((snapshot, event) => machine.transition(snapshot, event)[0], machine.initialState);
