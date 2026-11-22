import { NodeRuntime } from "@effect/platform-node";
import { Effect, Result } from "effect";

import { withDatabase } from "#/database/database.ts";
import { migrationsDirectory } from "#/database/migration-files.ts";
import { rollbackArgs } from "#/database/rollback-args.ts";
import { rollback, RollbackFailed } from "#/database/rollback.ts";

const program = Effect.gen(function* () {
  const { to } = yield* Result.match(rollbackArgs(process.argv.slice(2)), {
    onSuccess: Effect.succeed,
    onFailure: (message) => Effect.fail(new RollbackFailed({ message })),
  });

  const reverted = yield* withDatabase(rollback({ directory: migrationsDirectory, to }));

  if (reverted.length === 0) yield* Effect.log("No migration to revert.");
});

program.pipe(NodeRuntime.runMain);
