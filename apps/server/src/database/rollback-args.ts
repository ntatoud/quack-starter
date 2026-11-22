import { parseArgs } from "node:util";

import { Result } from "effect";

const ID = /^\d+$/;

export interface RollbackArgs {
  readonly to: number | undefined;
}

export const rollbackArgs = (args: ReadonlyArray<string>): Result.Result<RollbackArgs, string> => {
  const parsed = Result.try({
    try: () => parseArgs({ args: [...args], options: { to: { type: "string" } }, strict: true }),
    catch: (error) => (error instanceof Error ? error.message : String(error)),
  });

  return Result.flatMap(parsed, ({ values: { to } }): Result.Result<RollbackArgs, string> => {
    if (to === undefined) return Result.succeed({ to: undefined });

    if (!ID.test(to)) {
      return Result.fail("--to takes the id of a migration: a whole number, 0 or more.");
    }

    return Result.succeed({ to: Number(to) });
  });
};
