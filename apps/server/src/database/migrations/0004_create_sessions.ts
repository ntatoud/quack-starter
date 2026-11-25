import { executor, postgres } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";

const { schema } = postgres();

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    schema
      .createTable("sessions")
      .addColumn("token_hash", "text")
      .addColumn("user_id", "uuid", (column) => column.notNull())
      .addColumn("expires_at", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("sessions_pkey", ["token_hash"])
      .addForeignKeyConstraint("sessions_user_id_fkey", ["user_id"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      ),
  );
  yield* execute(schema.createIndex("sessions_user_id_idx").on("sessions").column("user_id"));
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(schema.dropTable("sessions"));
});
