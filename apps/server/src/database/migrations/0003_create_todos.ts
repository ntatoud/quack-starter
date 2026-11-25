import { executor } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";

import { db } from "#/database/db.ts";

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    db.schema
      .createTable("todos")
      .addColumn("id", "uuid")
      .addColumn("ownerId", "uuid", (column) => column.notNull())
      .addColumn("title", "text", (column) => column.notNull())
      .addColumn("completed", "boolean", (column) => column.notNull())
      .addColumn("createdAt", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("todos_pkey", ["id"])
      .addForeignKeyConstraint("todos_owner_id_fkey", ["ownerId"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      ),
  );
  yield* execute(db.schema.createIndex("todos_owner_id_idx").on("todos").column("ownerId"));
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(db.schema.dropTable("todos"));
});
