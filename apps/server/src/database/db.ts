import { postgres } from "@quack/effect-kysely/kysely";
import { Schema } from "effect";
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

// An id of a uuid column: Postgres refuses to compare it with any other text, and fails the request, where no row
// could have it. A query by an id that is not one finds nothing without running.
export const isStorableId = Schema.is(Schema.String.check(Schema.isUUID()));
