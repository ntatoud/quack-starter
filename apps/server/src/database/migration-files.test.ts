import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  loadMigrationFiles,
  migrationProblems,
  migrationsDirectory,
} from "#/database/migration-files.ts";

const migration = (name: string) => ({
  name,
  exports: { default: Effect.void, down: Effect.void },
});

describe("migrationProblems", () => {
  it("accepts ids that run from 1 with no gap", () => {
    expect(
      migrationProblems([
        migration("0002_create_sessions.ts"),
        migration("0001_create_users.ts"),
        migration("0003_create_todos.ts"),
      ]),
    ).toEqual([]);
  });

  it("accepts no migration at all", () => {
    expect(migrationProblems([])).toEqual([]);
  });

  it("reports a gap in the ids", () => {
    expect(
      migrationProblems([migration("0001_create_users.ts"), migration("0003_create_todos.ts")]),
    ).toEqual(["Migration 2 is missing: the ids must run from 1 with no gap."]);
  });

  it("reports ids that do not start at 1", () => {
    expect(migrationProblems([migration("0002_create_users.ts")])).toEqual([
      "Migration 1 is missing: the ids must run from 1 with no gap.",
    ]);
  });

  it("reports two migrations with the same id", () => {
    expect(
      migrationProblems([
        migration("0001_create_users.ts"),
        migration("0002_create_sessions.ts"),
        migration("0002_create_todos.ts"),
      ]),
    ).toEqual([
      "Migration 2 is used by 0002_create_sessions.ts and 0002_create_todos.ts: each id belongs to one migration.",
    ]);
  });

  it("reports a migration without a down", () => {
    expect(
      migrationProblems([{ name: "0001_create_users.ts", exports: { default: Effect.void } }]),
    ).toEqual(["0001_create_users.ts exports no down Effect: every migration can be reverted."]);
  });

  it("reports a migration without an up", () => {
    expect(
      migrationProblems([{ name: "0001_create_users.ts", exports: { down: Effect.void } }]),
    ).toEqual(["0001_create_users.ts exports no default Effect: it is the migration's up."]);
  });

  it("reports a file whose name the migrator would not read as a migration", () => {
    expect(migrationProblems([migration("1_create_users.ts")])).toEqual([
      "1_create_users.ts is not named <4-digit id>_<snake_case_name>.ts.",
    ]);
  });
  it("reports a file in another format, which the check could not read", () => {
    expect(
      migrationProblems([
        migration("0001_create_users.ts"),
        { name: "0002_create_todos.js", exports: {} },
      ]),
    ).toEqual(["0002_create_todos.js is not named <4-digit id>_<snake_case_name>.ts."]);
  });
});

describe("the migrations of the server", () => {
  it("run from 1 with no gap, and each one can be reverted", async () => {
    expect(migrationProblems(await loadMigrationFiles(migrationsDirectory))).toEqual([]);
  });
});
