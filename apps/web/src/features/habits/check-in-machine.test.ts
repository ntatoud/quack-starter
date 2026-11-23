import { describe, expect, it } from "vite-plus/test";

import { checkInMachine } from "#/features/habits/check-in-machine.ts";
import { reachableSnapshots, runMachine } from "#/testing/run-machine.ts";

type Event = Parameters<typeof checkInMachine.transition>[1];

const run = (...events: ReadonlyArray<Event>) => runMachine(checkInMachine, ...events);

describe("checkInMachine", () => {
  it("runs one request at a time", () => {
    expect(run({ type: "check" }, { type: "uncheck" }).value).toBe("checking");
    expect(run({ type: "uncheck" }, { type: "check" }).value).toBe("unchecking");
  });

  it("says which request failed", () => {
    expect(run({ type: "check" }, { type: "failed" })).toMatchObject({
      value: "failed",
      context: { failedTo: "check" },
    });
    expect(run({ type: "uncheck" }, { type: "failed" })).toMatchObject({
      value: "failed",
      context: { failedTo: "uncheck" },
    });
  });

  it("clears a failure with the next request, of either kind", () => {
    expect(run({ type: "check" }, { type: "failed" }, { type: "uncheck" }).value).toBe(
      "unchecking",
    );
    expect(
      run({ type: "uncheck" }, { type: "failed" }, { type: "check" }, { type: "succeeded" }).value,
    ).toBe("idle");
  });
});

describe("checkInMachine, explored", () => {
  const snapshots = reachableSnapshots(checkInMachine, [
    { type: "check" },
    { type: "uncheck" },
    { type: "succeeded" },
    { type: "failed" },
  ]);

  it("reaches every state", () => {
    expect(new Set(snapshots.map(({ value }) => value))).toEqual(
      new Set(["idle", "checking", "unchecking", "failed"]),
    );
  });

  it("knows which request failed only while it says so", () => {
    for (const snapshot of snapshots) {
      if (snapshot.value !== "failed") expect(snapshot.context.failedTo).toBeUndefined();
    }
  });
});
