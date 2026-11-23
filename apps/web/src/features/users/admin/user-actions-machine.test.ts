import { describe, expect, it } from "vite-plus/test";

import { userActionsMachine } from "#/features/users/admin/user-actions-machine.ts";
import { runMachine } from "#/testing/run-machine.ts";

type Event = Parameters<typeof userActionsMachine.transition>[1];

const run = (...events: ReadonlyArray<Event>) => runMachine(userActionsMachine, ...events);

describe("userActionsMachine", () => {
  it("says a change made at once failed beside the buttons, until the next action", () => {
    expect(run({ type: "apply" }, { type: "failed" }).value).toBe("changeFailed");
    expect(run({ type: "apply" }, { type: "failed" }, { type: "apply" }).value).toBe("changing");
    expect(
      run({ type: "apply" }, { type: "failed" }, { type: "ask", which: "suspend" }),
    ).toMatchObject({ value: "asking", context: { which: "suspend" } });
  });

  it("asks nothing while a change runs", () => {
    expect(run({ type: "apply" }, { type: "ask", which: "delete" }).value).toBe("changing");
  });

  it("keeps the dialog open while its request runs, and after it fails", () => {
    const confirming = [{ type: "ask", which: "delete" }, { type: "confirm" }] as const;

    expect(run(...confirming, { type: "dismiss" })).toMatchObject({
      value: "confirming",
      context: { which: "delete" },
    });
    expect(run(...confirming, { type: "failed" })).toMatchObject({
      value: "confirmFailed",
      context: { which: "delete" },
    });
    expect(run(...confirming, { type: "succeeded" }).value).toBe("idle");
  });

  it("forgets a failure in a dialog once it is closed, or tried again", () => {
    const failed = [
      { type: "ask", which: "promote" },
      { type: "confirm" },
      { type: "failed" },
    ] as const;

    expect(run(...failed, { type: "dismiss" }).value).toBe("idle");
    expect(run(...failed, { type: "confirm" }).value).toBe("confirming");
  });
});
