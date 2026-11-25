import { executor, postgres } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";
import { sql } from "kysely";

const { schema } = postgres();

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    schema
      .createTable("authorization_codes")
      .addColumn("code_hash", "text")
      .addColumn("user_id", "uuid", (column) => column.notNull())
      .addColumn("ai_client_id", "text", (column) => column.notNull())
      .addColumn("ai_client_name", "text", (column) => column.notNull())
      .addColumn("redirect_uri", "text", (column) => column.notNull())
      .addColumn("resource", "text", (column) => column.notNull())
      .addColumn("permissions", sql`text[]`, (column) => column.notNull())
      .addColumn("code_challenge", "text", (column) => column.notNull())
      .addColumn("expires_at", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("authorization_codes_pkey", ["code_hash"])
      .addForeignKeyConstraint(
        "authorization_codes_user_id_fkey",
        ["user_id"],
        "users",
        ["id"],
        (fk) => fk.onDelete("cascade"),
      ),
  );
  yield* execute(
    schema
      .createIndex("authorization_codes_user_id_idx")
      .on("authorization_codes")
      .column("user_id"),
  );
});

// The codes live a minute: dropping them loses nothing an AI Client could not ask for again.
export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(schema.dropTable("authorization_codes"));
});
