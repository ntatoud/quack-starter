import { describe, expect, it } from "vite-plus/test";

import { todoItemMachine } from "#/features/todos/todo-item-machine.ts";
import { runMachine } from "#/testing/run-machine.ts";

type Event = Parameters<typeof todoItemMachine.transition>[1];

const run = (...events: ReadonlyArray<Event>) => runMachine(todoItemMachine, ...events);

describe("todoItemMachine", () => {
  it("runs one request at a time", () => {
    expect(run({ type: "complete" }, { type: "remove" }).value).toBe("completing");
    expect(run({ type: "remove" }, { type: "complete" }).value).toBe("removing");
  });

  it("says which request failed", () => {
    expect(run({ type: "complete" }, { type: "failed" })).toMatchObject({
      value: "failed",
      context: { failedTo: "complete" },
    });
    expect(run({ type: "remove" }, { type: "failed" })).toMatchObject({
      value: "failed",
      context: { failedTo: "remove" },
    });
  });

  it("clears a failure with the next request, of either kind", () => {
    expect(run({ type: "complete" }, { type: "failed" }, { type: "remove" }).value).toBe(
      "removing",
    );
    expect(
      run({ type: "remove" }, { type: "failed" }, { type: "complete" }, { type: "succeeded" })
        .value,
    ).toBe("idle");
  });
});
