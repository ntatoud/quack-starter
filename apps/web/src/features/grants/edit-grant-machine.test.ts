import type { Permission } from "@quack/contracts/permission";
import { describe, expect, it } from "vite-plus/test";

import { editGrantMachine } from "#/features/grants/edit-grant-machine.ts";
import { runMachine } from "#/testing/run-machine.ts";

type Event = Parameters<typeof editGrantMachine.transition>[1];

const held: ReadonlyArray<Permission> = ["todos:list", "todos:write"];

const run = (...events: ReadonlyArray<Event>) => runMachine(editGrantMachine, ...events);

describe("editGrantMachine", () => {
  it("starts closed", () => {
    expect(editGrantMachine.initialState.value).toBe("closed");
  });

  it("opens on what the Grant holds, whatever was ticked before", () => {
    const snapshot = run(
      { type: "open", held },
      { type: "toggle", permission: "todos:delete", on: true },
      { type: "close" },
      { type: "open", held },
    );

    expect(snapshot.value).toBe("editing");
    expect([...snapshot.context.ticked]).toEqual(held);
  });

  it("reviews only a change that leaves at least one Permission", () => {
    const opened = { type: "open", held } as const;

    expect(run(opened, { type: "review", held }).value).toBe("editing");
    expect(
      run(
        opened,
        { type: "toggle", permission: "todos:list", on: false },
        { type: "toggle", permission: "todos:write", on: false },
        { type: "review", held },
      ).value,
    ).toBe("editing");
    expect(
      run(
        opened,
        { type: "toggle", permission: "todos:delete", on: true },
        { type: "review", held },
      ).value,
    ).toBe("reviewing");
  });

  it("goes back to the ticks it reviewed, which it cannot change while reviewing", () => {
    const snapshot = run(
      { type: "open", held },
      { type: "toggle", permission: "todos:delete", on: true },
      { type: "review", held },
      { type: "toggle", permission: "todos:list", on: false },
      { type: "back" },
    );

    expect(snapshot.value).toBe("editing");
    expect([...snapshot.context.ticked]).toEqual([...held, "todos:delete"]);
  });

  it("remembers the step it closed on, so it stays on screen as the dialog fades out", () => {
    const reviewed = run(
      { type: "open", held },
      { type: "toggle", permission: "todos:delete", on: true },
      { type: "review", held },
      { type: "close" },
    );

    expect(reviewed).toMatchObject({ value: "closed", context: { closedOn: "reviewing" } });
    expect(run({ type: "open", held }, { type: "close" })).toMatchObject({
      value: "closed",
      context: { closedOn: "editing" },
    });
  });
});
