import { act } from "react";
import { describe, expect, it } from "vite-plus/test";
import { renderHook } from "vitest-browser-react";
import { createFSM } from "xstate/fsm";

import { useFsm } from "#/lib/use-fsm.ts";

const machine = createFSM<{}, { type: "start" } | { type: "finish" }>({
  initial: "idle",
  states: {
    idle: { on: { start: { target: "running" } } },
    running: { on: { finish: { target: "done" } } },
    done: {},
  },
});

describe("useFsm", () => {
  it("answers whether the machine took an event, seeing the events sent before it in the same handler", async () => {
    const { result } = await renderHook(() => useFsm(machine));
    const answers: Array<boolean> = [];

    act(() => {
      const [, send] = result.current;
      answers.push(
        send({ type: "finish" }),
        send({ type: "start" }),
        send({ type: "start" }),
        send({ type: "finish" }),
      );
    });

    expect(answers).toEqual([false, true, false, true]);
    expect(result.current[0].value).toBe("done");
  });

  it("says whether the rendered snapshot would take an event, without sending it", async () => {
    const { result } = await renderHook(() => useFsm(machine));
    const [snapshot, , can] = result.current;

    expect([can({ type: "start" }), can({ type: "finish" })]).toEqual([true, false]);
    expect(result.current[0]).toBe(snapshot);
  });
});
