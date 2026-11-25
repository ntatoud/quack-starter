import { executor } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";

import { db } from "#/database/db.ts";

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    db.schema
      .createTable("sessions")
      .addColumn("tokenHash", "text")
      .addColumn("userId", "uuid", (column) => column.notNull())
      .addColumn("expiresAt", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("sessions_pkey", ["tokenHash"])
      .addForeignKeyConstraint("sessions_user_id_fkey", ["userId"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      ),
  );
  yield* execute(db.schema.createIndex("sessions_user_id_idx").on("sessions").column("userId"));
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(db.schema.dropTable("sessions"));
});
