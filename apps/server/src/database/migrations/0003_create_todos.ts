import { executor, postgres } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";

const { schema } = postgres();

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    schema
      .createTable("todos")
      .addColumn("id", "uuid")
      .addColumn("owner_id", "uuid", (column) => column.notNull())
      .addColumn("title", "text", (column) => column.notNull())
      .addColumn("completed", "boolean", (column) => column.notNull())
      .addColumn("created_at", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("todos_pkey", ["id"])
      .addForeignKeyConstraint("todos_owner_id_fkey", ["owner_id"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      ),
  );
  yield* execute(schema.createIndex("todos_owner_id_idx").on("todos").column("owner_id"));
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(schema.dropTable("todos"));
});
