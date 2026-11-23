import type { Permission } from "@quack/contracts/permission";
import { describe, expect, it } from "vite-plus/test";

import { consentMachine } from "#/features/oauth/consent-machine.ts";
import { reachableSnapshots, runMachine } from "#/testing/run-machine.ts";

const machine = consentMachine(new Set<Permission>(["todos:list"]));

type Event = Parameters<typeof machine.transition>[1];

const run = (...events: ReadonlyArray<Event>) => runMachine(machine, ...events);
const untick = { type: "toggle", permission: "todos:list", on: false } as const;

describe("consentMachine", () => {
  it("cannot approve nothing, but can still deny", () => {
    expect(run(untick, { type: "approve" }).value).toBe("asking");
    expect(run(untick, { type: "deny" }).value).toBe("answering");
  });

  it("answers once: nothing changes while the answer is on its way", () => {
    const snapshot = run({ type: "approve" }, untick, { type: "deny" });

    expect(snapshot.value).toBe("answering");
    expect([...snapshot.context.ticked]).toEqual(["todos:list"]);
  });

  it("lets the User answer again, ticks included, once an answer fails", () => {
    const failed = [{ type: "approve" }, { type: "failed" }] as const;

    expect(run(...failed).value).toBe("failed");
    expect(run(...failed, untick, { type: "deny" }).value).toBe("answering");
  });

  it("leaves once an answer is sent, for good", () => {
    expect(run({ type: "deny" }, { type: "succeeded" }, { type: "approve" }).value).toBe("leaving");
  });
});

describe("consentMachine, explored", () => {
  const snapshots = reachableSnapshots(machine, [
    untick,
    { type: "toggle", permission: "todos:list", on: true },
    { type: "toggle", permission: "todos:write", on: true },
    { type: "approve" },
    { type: "deny" },
    { type: "succeeded" },
    { type: "failed" },
  ]);

  it("reaches every state", () => {
    expect(new Set(snapshots.map(({ value }) => value))).toEqual(
      new Set(["asking", "answering", "failed", "leaving"]),
    );
  });

  it("refuses to approve nothing, from every snapshot it reaches", () => {
    const empty = snapshots.filter(({ context }) => context.ticked.size === 0);

    expect(empty.length).toBeGreaterThan(0);

    for (const snapshot of empty) {
      expect(machine.transition(snapshot, { type: "approve" })[0]).toBe(snapshot);
    }
  });

  it("takes no event once leaving", () => {
    const events = [untick, { type: "approve" }, { type: "deny" }, { type: "failed" }] as const;

    for (const snapshot of snapshots.filter(({ value }) => value === "leaving")) {
      for (const event of events) expect(machine.transition(snapshot, event)[0]).toBe(snapshot);
    }
  });
});
