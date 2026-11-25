import { postgres } from "@quack/effect-kysely/kysely";
import { CamelCasePlugin } from "kysely";

import type { DB } from "#/database/db.gen.ts";

export type ReadonlyArrays<Value> =
  Value extends ReadonlyArray<infer Element> ? ReadonlyArray<Element> : Value;

// The tables kysely-codegen generates, an array column readonly, as the contracts' arrays are: Kysely writes both alike.
export type Tables = {
  readonly [Table in keyof DB]: {
    readonly [Column in keyof DB[Table]]: ReadonlyArrays<DB[Table][Column]>;
  };
};

// Names the columns in snake_case, as the SqlClient does for `sql("createdAt")`; the client maps rows back.
export const db = postgres<Tables>({ plugins: [new CamelCasePlugin()] });
