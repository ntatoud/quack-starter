import { describe, expect, it } from "vite-plus/test";

import { checkRecorded, databaseFor, ownDatabaseName } from "#/dev/database-choice.ts";

describe("ownDatabaseName", () => {
  it("slugs the full branch name after quack_", () => {
    expect(ownDatabaseName("feat/postgres-database")).toBe("quack_feat_postgres_database");
  });

  it("lowercases, and joins every run of other characters into one underscore", () => {
    expect(ownDatabaseName("Fix/#42--Sign.In ")).toBe("quack_fix_42_sign_in");
  });

  it("keeps the first 63 characters, the longest name Postgres keeps", () => {
    const name = ownDatabaseName(`feat/${"a".repeat(80)}`);

    expect(name).toBe(`quack_feat_${"a".repeat(52)}`);
    expect(name).toHaveLength(63);
  });

  it("drops the underscores the cut leaves at the end", () => {
    expect(ownDatabaseName(`feat/${"a".repeat(51)}-b`)).toBe(`quack_feat_${"a".repeat(51)}`);
  });
});

describe("databaseFor", () => {
  const worktree = {
    devDatabase: undefined,
    branch: "feat/todos-due-date",
    defaultMigrations: ["0001_create_users.ts", "0002_create_todos.ts"],
  };

  it("gives the shared database to a branch with the migrations of the default branch", () => {
    expect(
      databaseFor({ ...worktree, migrations: ["0001_create_users.ts", "0002_create_todos.ts"] }),
    ).toBe("quack");
  });

  it("gives the shared database to a branch that lacks migrations of the default branch", () => {
    expect(databaseFor({ ...worktree, migrations: ["0001_create_users.ts"] })).toBe("quack");
  });

  it("gives a database of its own to a branch that adds a migration", () => {
    expect(
      databaseFor({
        ...worktree,
        migrations: ["0001_create_users.ts", "0002_create_todos.ts", "0003_add_due_date.ts"],
      }),
    ).toBe("quack_feat_todos_due_date");
  });

  it("gives a database of its own to a branch that renames a migration", () => {
    expect(
      databaseFor({ ...worktree, migrations: ["0001_create_users.ts", "0002_create_tasks.ts"] }),
    ).toBe("quack_feat_todos_due_date");
  });

  it("gives a database of its own to a branch with migrations, when no default branch lists one", () => {
    expect(
      databaseFor({ ...worktree, defaultMigrations: [], migrations: ["0001_create_users.ts"] }),
    ).toBe("quack_feat_todos_due_date");
  });

  it("gives a database of its own to any worktree with DEV_DATABASE=own", () => {
    expect(
      databaseFor({ ...worktree, devDatabase: "own", migrations: worktree.defaultMigrations }),
    ).toBe("quack_feat_todos_due_date");
  });
});

describe("checkRecorded", () => {
  const migrations = ["0001_create_users.ts", "0002_create_todos.ts"];

  it("finds nothing when every recorded migration is a file of the branch", () => {
    expect(
      checkRecorded({
        migrations,
        recorded: [{ id: 1, name: "create_users" }],
      }),
    ).toEqual({ behind: [], diverged: [] });
  });

  it("finds the branch behind when the database records a migration the branch lacks", () => {
    expect(
      checkRecorded({
        migrations,
        recorded: [
          { id: 1, name: "create_users" },
          { id: 2, name: "create_todos" },
          { id: 3, name: "add_due_date" },
        ],
      }),
    ).toEqual({ behind: [{ id: 3, name: "add_due_date" }], diverged: [] });
  });

  it("finds the branches diverged when a recorded id names another file of the branch", () => {
    expect(
      checkRecorded({
        migrations,
        recorded: [
          { id: 1, name: "create_users" },
          { id: 2, name: "create_tasks" },
        ],
      }),
    ).toEqual({
      behind: [],
      diverged: [{ id: 2, recorded: "create_tasks", file: "0002_create_todos.ts" }],
    });
  });
});
