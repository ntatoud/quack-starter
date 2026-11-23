import { useCallback, useRef, useState } from "react";

/**
 * The snapshot of an `xstate/fsm` machine in this component, and the function that sends it an event. The machine is
 * pure, so React's state runs it, with no actor. `send` answers whether the machine took the event, so a request
 * starts only from a state that allows it.
 */
export const useFsm = <TSnapshot, TEvent>(machine: {
  readonly initialState: TSnapshot;
  transition(snapshot: TSnapshot, event: TEvent): readonly [TSnapshot, ReadonlyArray<unknown>];
}) => {
  const [snapshot, setSnapshot] = useState(machine.initialState);
  // Two events sent in one handler see each other, which a snapshot read from a render would not.
  const current = useRef(snapshot);

  const send = useCallback(
    (event: TEvent) => {
      // A machine answers the snapshot it was given when it does not take the event.
      const [next] = machine.transition(current.current, event);

      if (next === current.current) return false;

      current.current = next;
      setSnapshot(next);

      return true;
    },
    [machine],
  );

  return [snapshot, send] as const;
};
