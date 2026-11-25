import { executor, postgres } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";

const { schema } = postgres();

export default Effect.gen(function* () {
  const execute = yield* executor;
  // One table for every link sent by email (a Password Reset, an Email Change), told apart by `purpose`.
  yield* execute(
    schema
      .createTable("link_tokens")
      .addColumn("token_hash", "text")
      .addColumn("user_id", "uuid", (column) => column.notNull())
      .addColumn("purpose", "text", (column) => column.notNull())
      .addColumn("expires_at", "timestamptz", (column) => column.notNull())
      // The email an Email Change link makes the User's, null for the other purposes.
      .addColumn("new_email", "text")
      .addPrimaryKeyConstraint("link_tokens_pkey", ["token_hash"])
      .addForeignKeyConstraint("link_tokens_user_id_fkey", ["user_id"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      )
      .addUniqueConstraint("link_tokens_user_id_purpose_key", ["user_id", "purpose"]),
  );
});

// The links live a day at most: dropping them loses nothing a User could not ask for again.
export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(schema.dropTable("link_tokens"));
});
