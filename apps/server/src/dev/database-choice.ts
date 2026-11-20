import { Schema } from "effect";

import { parseMigrationFileName } from "#/database/migration-files.ts";
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

export const Divergence = Schema.Struct({
  id: Schema.Int,
  recorded: Schema.String,
  file: Schema.String,
});

export const checkRecorded = ({
  migrations,
  recorded,
}: {
  readonly migrations: ReadonlyArray<string>;
  readonly recorded: ReadonlyArray<AppliedMigration>;
}): {
  readonly behind: ReadonlyArray<AppliedMigration>;
  readonly diverged: ReadonlyArray<typeof Divergence.Type>;
} => {
  const files = migrations.flatMap((file) => {
    const parsed = parseMigrationFileName(file);
    return parsed === undefined ? [] : [{ ...parsed, file }];
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
