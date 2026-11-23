import type { Permission } from "@quack/contracts/permission";
import { describe, expect, it } from "vite-plus/test";

import { consentMachine } from "#/features/oauth/consent-machine.ts";
import { runMachine } from "#/testing/run-machine.ts";

const machine = consentMachine(new Set<Permission>(["todos:list"]));

type Event = Parameters<typeof machine.transition>[1];

const run = (...events: ReadonlyArray<Event>) => runMachine(machine, ...events);
const untick = { type: "toggle", permission: "todos:list", on: false } as const;

describe("consentMachine", () => {
  it("cannot approve nothing, but can still deny", () => {
    expect(run(untick, { type: "answer", answer: "approve" }).value).toBe("asking");
    expect(run(untick, { type: "answer", answer: "deny" }).value).toBe("answering");
  });

  it("answers once: nothing changes while the answer is on its way", () => {
    const snapshot = run({ type: "answer", answer: "approve" }, untick, {
      type: "answer",
      answer: "deny",
    });

    expect(snapshot.value).toBe("answering");
    expect([...snapshot.context.ticked]).toEqual(["todos:list"]);
  });

  it("lets the User answer again, ticks included, once an answer fails", () => {
    const failed = [{ type: "answer", answer: "approve" }, { type: "failed" }] as const;

    expect(run(...failed).value).toBe("failed");
    expect(run(...failed, untick, { type: "answer", answer: "deny" }).value).toBe("answering");
  });

  it("leaves once an answer is sent, for good", () => {
    expect(
      run(
        { type: "answer", answer: "deny" },
        { type: "succeeded" },
        { type: "answer", answer: "approve" },
      ).value,
    ).toBe("leaving");
  });
});
