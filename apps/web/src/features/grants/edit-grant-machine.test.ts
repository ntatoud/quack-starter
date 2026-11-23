import type { Permission } from "@quack/contracts/permission";
import { describe, expect, it } from "vite-plus/test";

import { editGrantMachine } from "#/features/grants/edit-grant-machine.ts";
import { reachableSnapshots, runMachine } from "#/testing/run-machine.ts";

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

describe("editGrantMachine, explored", () => {
  const snapshots = reachableSnapshots(editGrantMachine, [
    { type: "open", held },
    { type: "toggle", permission: "todos:delete", on: true },
    { type: "toggle", permission: "todos:list", on: false },
    { type: "toggle", permission: "todos:write", on: false },
    { type: "review", held },
    { type: "back" },
    { type: "close" },
  ]);

  it("reaches every state", () => {
    expect(new Set(snapshots.map(({ value }) => value))).toEqual(
      new Set(["closed", "editing", "reviewing"]),
    );
  });

  it("never reviews no Permission, nor what the Grant already holds", () => {
    const reviewed = snapshots.filter(({ value }) => value === "reviewing");

    expect(reviewed.length).toBeGreaterThan(0);

    for (const { context } of reviewed) {
      expect(context.ticked.size).toBeGreaterThan(0);
      expect(context.ticked).not.toEqual(new Set(held));
    }
  });

  it("keeps the step it closed on only while closed", () => {
    for (const snapshot of snapshots) {
      if (snapshot.value !== "closed") expect(snapshot.context.closedOn).toBeUndefined();
    }
  });
});
