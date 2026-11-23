import { useCallback, useRef, useState } from "react";

/**
 * Runs an `xstate/fsm` machine in this component, in React state: the machine is pure, so it needs no actor. Sending
 * an event answers whether the machine took it, so a request starts only from a state that allows it. Asking whether
 * the rendered snapshot would take an event disables a control by the machine's own rule, not by a copy of it.
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

  const can = (event: TEvent) => machine.transition(snapshot, event)[0] !== snapshot;

  return [snapshot, send, can] as const;
};
