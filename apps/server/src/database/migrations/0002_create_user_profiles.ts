import { executor, postgres } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";

const { schema } = postgres();

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    schema
      .createTable("user_profiles")
      .addColumn("user_id", "uuid")
      .addColumn("first_name", "text", (column) => column.notNull())
      .addColumn("last_name", "text", (column) => column.notNull())
      .addColumn("job_title", "text", (column) => column.notNull())
      .addColumn("team", "text")
      .addColumn("country", "text")
      .addColumn("avatar_url", "text")
      .addPrimaryKeyConstraint("user_profiles_pkey", ["user_id"])
      .addForeignKeyConstraint("user_profiles_user_id_fkey", ["user_id"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      ),
  );
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(schema.dropTable("user_profiles"));
});
