import { executor } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";

import { db } from "#/database/db.ts";

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    db.schema
      .createTable("user_profiles")
      .addColumn("userId", "uuid")
      .addColumn("firstName", "text", (column) => column.notNull())
      .addColumn("lastName", "text", (column) => column.notNull())
      .addColumn("jobTitle", "text", (column) => column.notNull())
      .addColumn("team", "text")
      .addColumn("country", "text")
      .addColumn("avatarUrl", "text")
      .addPrimaryKeyConstraint("user_profiles_pkey", ["userId"])
      .addForeignKeyConstraint("user_profiles_user_id_fkey", ["userId"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      ),
  );
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(db.schema.dropTable("user_profiles"));
});
