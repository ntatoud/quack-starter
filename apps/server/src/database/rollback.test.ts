import { Effect, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { rollbackPlan } from "#/database/rollback.ts";

const downOf = (name: string) => Effect.log(`down of ${name}`);

const file = (name: string) => ({
  name,
  exports: { default: Effect.void, down: downOf(name) },
});

const files = [
  file("0001_create_users.ts"),
  file("0002_create_sessions.ts"),
  file("0003_create_todos.ts"),
];

const applied = [
  { id: 1, name: "create_users" },
  { id: 2, name: "create_sessions" },
  { id: 3, name: "create_todos" },
];

const reverted = (plan: ReturnType<typeof rollbackPlan>) =>
  Result.map(plan, (steps) => steps.map(({ id, name }) => `${id}_${name}`));

describe("rollbackPlan", () => {
  it("reverts the latest applied migration only", () => {
    expect(reverted(rollbackPlan({ applied, files, to: undefined }))).toEqual(
      Result.succeed(["3_create_todos"]),
    );
  });

  it("reverts every migration above the id of --to, latest first", () => {
    expect(reverted(rollbackPlan({ applied, files, to: 1 }))).toEqual(
      Result.succeed(["3_create_todos", "2_create_sessions"]),
    );
  });

  it("reverts every migration with --to 0", () => {
    expect(reverted(rollbackPlan({ applied, files, to: 0 }))).toEqual(
      Result.succeed(["3_create_todos", "2_create_sessions", "1_create_users"]),
    );
  });

  it("reverts nothing when --to is at or above the latest applied migration", () => {
    expect(reverted(rollbackPlan({ applied, files, to: 3 }))).toEqual(Result.succeed([]));
  });

  it("reverts nothing when no migration is applied", () => {
    expect(reverted(rollbackPlan({ applied: [], files, to: undefined }))).toEqual(
      Result.succeed([]),
    );
  });

  it("runs the down exported by the file of each migration", () => {
    const plan = rollbackPlan({ applied, files, to: 2 });
    expect(Result.map(plan, (steps) => steps.map(({ down }) => down))).toEqual(
      Result.succeed([files[2]?.exports.down]),
    );
  });

  it("refuses an applied migration whose file is not there", () => {
    expect(rollbackPlan({ applied, files: files.slice(0, 2), to: undefined })).toEqual(
      Result.fail(
        "Migration 3_create_todos is applied, but no file 0003_create_todos.ts holds it: check out the code that added it.",
      ),
    );
  });

  it("refuses a file that exports no down Effect", () => {
    expect(
      rollbackPlan({
        applied,
        files: [...files.slice(0, 2), { name: "0003_create_todos.ts", exports: {} }],
        to: undefined,
      }),
    ).toEqual(Result.fail("0003_create_todos.ts exports no down Effect: it cannot be reverted."));
  });
});
