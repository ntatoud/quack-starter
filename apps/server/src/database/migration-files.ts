import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { pathToFileURL } from "node:url";

import { Array, Effect, Order } from "effect";

export const migrationsDirectory = Path.join(import.meta.dirname, "migrations");

const NAME = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.ts$/;

export const parseMigrationFileName = (
  file: string,
): { readonly id: number; readonly name: string } | undefined => {
  const [, id, name] = NAME.exec(file) ?? [];
  return id === undefined || name === undefined ? undefined : { id: Number(id), name };
};

export const migrationFileNames = async (directory: string): Promise<ReadonlyArray<string>> =>
  (await Fs.readdir(directory)).filter((name) => !name.startsWith("."));

export interface MigrationFile {
  readonly name: string;
  readonly exports: Readonly<Record<string, unknown>>;
}

export const loadMigrationFiles = async (
  directory: string,
): Promise<ReadonlyArray<MigrationFile>> => {
  const names = await migrationFileNames(directory);
  return Promise.all(
    names.map(async (name) => ({
      name,
      exports: NAME.test(name)
        ? ((await import(pathToFileURL(Path.join(directory, name)).href)) as Record<
            string,
            unknown
          >)
        : {},
    })),
  );
};

const exportProblems = ({ name, exports }: MigrationFile): ReadonlyArray<string> => [
  ...(Effect.isEffect(exports["default"])
    ? []
    : [`${name} exports no default Effect: it is the migration's up.`]),
  ...(Effect.isEffect(exports["down"])
    ? []
    : [`${name} exports no down Effect: every migration can be reverted.`]),
];

export const migrationProblems = (files: ReadonlyArray<MigrationFile>): ReadonlyArray<string> => {
  const named = files.flatMap((file) => {
    const id = NAME.exec(file.name)?.[1];
    return id === undefined ? [] : [{ id: Number(id), file }];
  });
  const byId = Array.groupBy(named, ({ id }) => String(id));
  const highest = Math.max(0, ...named.map(({ id }) => id));
  return [
    ...files
      .filter((file) => !NAME.test(file.name))
      .map((file) => `${file.name} is not named <4-digit id>_<snake_case_name>.ts.`),
    ...(highest === 0 ? [] : Array.range(1, highest)).flatMap((id) => {
      const owners = Array.sort(
        (byId[String(id)] ?? []).map(({ file }) => file.name),
        Order.String,
      );
      if (owners.length === 0) {
        return [`Migration ${id} is missing: the ids must run from 1 with no gap.`];
      }
      if (owners.length > 1) {
        return [
          `Migration ${id} is used by ${owners.join(" and ")}: each id belongs to one migration.`,
        ];
      }
      return [];
    }),
    ...files.filter((file) => NAME.test(file.name)).flatMap(exportProblems),
  ];
};
