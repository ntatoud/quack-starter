import { Cause, Effect, Result, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

import { loadMigrationFiles, type MigrationFile } from "#/database/migration-files.ts";

export const MIGRATIONS_TABLE = "effect_sql_migrations";

export class RollbackFailed extends Schema.TaggedError<
  RollbackFailed,
  { readonly brand: unique symbol }
>()("RollbackFailed", { message: Schema.String }) {}

export interface AppliedMigration {
  readonly id: number;
  readonly name: string;
}

export interface RollbackStep extends AppliedMigration {
  readonly down: Effect.Effect<unknown, unknown, SqlClient.SqlClient>;
}

const label = ({ id, name }: AppliedMigration) => `${id}_${name}`;

const fileName = ({ id, name }: AppliedMigration) => `${String(id).padStart(4, "0")}_${name}.ts`;

const step = (
  migration: AppliedMigration,
  files: ReadonlyArray<MigrationFile>,
): Result.Result<RollbackStep, string> => {
  const file = files.find(({ name }) => name === fileName(migration));

  if (file === undefined) {
    return Result.fail(
      `Migration ${label(migration)} is applied, but no file ${fileName(migration)} holds it: check out the code that added it.`,
    );
  }

  const down = file.exports.down;

  if (!Effect.isEffect(down)) {
    return Result.fail(`${file.name} exports no down Effect: it cannot be reverted.`);
  }

  // A migration's down needs the SqlClient only, as its up does for the Migrator.
  return Result.succeed({ ...migration, down: down as RollbackStep["down"] });
};

export const rollbackPlan = ({
  applied,
  files,
  to,
}: {
  readonly applied: ReadonlyArray<AppliedMigration>;
  readonly files: ReadonlyArray<MigrationFile>;
  readonly to: number | undefined;
}): Result.Result<ReadonlyArray<RollbackStep>, string> => {
  const latestFirst = [...applied].sort((a, b) => b.id - a.id);

  const reverted =
    to === undefined ? latestFirst.slice(0, 1) : latestFirst.filter(({ id }) => id > to);

  return Result.all(reverted.map((migration) => step(migration, files)));
};

const reason = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);

  return error instanceof Error ? error.message : String(error);
};

const AppliedRow = Schema.Struct({ migrationId: Schema.Int, name: Schema.String });

export const migrationsTableExists = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const found = yield* SqlSchema.findAll({
    Request: Schema.Void,
    Result: Schema.Struct({ found: Schema.Int }),
    execute: () => sql`SELECT 1 AS found WHERE to_regclass(${MIGRATIONS_TABLE}) IS NOT NULL`,
  })(undefined);

  return found.length > 0;
});

export const appliedMigrations = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* SqlSchema.findAll({
    Request: Schema.Void,
    Result: AppliedRow,
    execute: () => sql`SELECT migration_id, name FROM ${sql(MIGRATIONS_TABLE)}`,
  })(undefined);

  return rows.map(({ migrationId, name }): AppliedMigration => ({ id: migrationId, name }));
});

export const rollback = Effect.fn("rollback")(function* ({
  directory,
  to,
}: {
  readonly directory: string;
  readonly to: number | undefined;
}) {
  const sql = yield* SqlClient.SqlClient;
  const files = yield* Effect.promise(() => loadMigrationFiles(directory));

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      if (!(yield* migrationsTableExists)) return [];
      // The lock the Migrator takes: a server starting meanwhile waits for the rollback to end.
      yield* sql`LOCK TABLE ${sql(MIGRATIONS_TABLE)} IN ACCESS EXCLUSIVE MODE`;
      const applied = yield* appliedMigrations;

      const steps = yield* Result.match(rollbackPlan({ applied, files, to }), {
        onSuccess: Effect.succeed,
        onFailure: (message) => Effect.fail(new RollbackFailed({ message })),
      });

      for (const migration of steps) {
        yield* migration.down.pipe(
          Effect.catchCause((cause) =>
            Effect.fail(
              new RollbackFailed({
                message: `Migration ${label(migration)} could not be reverted: ${reason(cause)}`,
              }),
            ),
          ),
        );
        yield* sql`DELETE FROM ${sql(MIGRATIONS_TABLE)} WHERE migration_id = ${migration.id}`;
        yield* Effect.log(`Reverted migration ${label(migration)}`);
      }

      return steps.map(label);
    }),
  );
});
