import type { AppliedMigration } from "#/database/rollback.ts";

const MAX_IDENTIFIER_LENGTH = 63;

export const sharedDatabase = "quack";

export const ownDatabaseName = (branch: string): string =>
  `${sharedDatabase}_${branch
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+/g, "")}`
    .slice(0, MAX_IDENTIFIER_LENGTH)
    .replace(/_+$/, "");

export const databaseFor = ({
  devDatabase,
  branch,
  migrations,
  defaultMigrations,
}: {
  readonly devDatabase: string | undefined;
  readonly branch: string;
  readonly migrations: ReadonlyArray<string>;
  readonly defaultMigrations: ReadonlyArray<string>;
}): string => {
  const addsMigrations = migrations.some((migration) => !defaultMigrations.includes(migration));
  return devDatabase === "own" || addsMigrations ? ownDatabaseName(branch) : sharedDatabase;
};

export interface Divergence {
  readonly id: number;
  readonly recorded: string;
  readonly file: string;
}

const FILE = /^(\d+)_(.+)\.ts$/;

export const checkRecorded = ({
  migrations,
  recorded,
}: {
  readonly migrations: ReadonlyArray<string>;
  readonly recorded: ReadonlyArray<AppliedMigration>;
}): {
  readonly behind: ReadonlyArray<AppliedMigration>;
  readonly diverged: ReadonlyArray<Divergence>;
} => {
  const files = migrations.flatMap((file) => {
    const match = FILE.exec(file);
    return match?.[1] === undefined ? [] : [{ id: Number(match[1]), name: match[2], file }];
  });
  return {
    behind: recorded.filter(({ id }) => !files.some((file) => file.id === id)),
    diverged: recorded.flatMap(({ id, name }) =>
      files
        .filter((file) => file.id === id && file.name !== name)
        .map(({ file }) => ({ id, recorded: name, file })),
    ),
  };
};
