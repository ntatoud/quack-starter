import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { rollbackArgs } from "#/database/rollback-args.ts";

describe("rollbackArgs", () => {
  it("reverts the latest migration when given nothing", () => {
    expect(rollbackArgs([])).toEqual(Result.succeed({ to: undefined }));
  });

  it("reads the id of --to", () => {
    expect(rollbackArgs(["--to", "2"])).toEqual(Result.succeed({ to: 2 }));
    expect(rollbackArgs(["--to=0"])).toEqual(Result.succeed({ to: 0 }));
  });

  it("refuses an id of --to that is not a whole number at or above 0", () => {
    const refused = Result.fail("--to takes the id of a migration: a whole number, 0 or more.");
    expect(rollbackArgs(["--to", "two"])).toEqual(refused);
    expect(rollbackArgs(["--to=-1"])).toEqual(refused);
    expect(rollbackArgs(["--to", "1.5"])).toEqual(refused);
    expect(rollbackArgs(["--to", ""])).toEqual(refused);
  });

  it("refuses an option it does not know", () => {
    expect(Result.isFailure(rollbackArgs(["--all"]))).toBe(true);
    expect(Result.isFailure(rollbackArgs(["3"]))).toBe(true);
  });
});
