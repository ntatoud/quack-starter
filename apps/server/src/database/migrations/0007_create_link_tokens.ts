import { executor } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";

import { db } from "#/database/db.ts";

export default Effect.gen(function* () {
  const execute = yield* executor;
  // One table for every link sent by email (a Password Reset, later an Email Change), told apart by `purpose`.
  yield* execute(
    db.schema
      .createTable("link_tokens")
      .addColumn("tokenHash", "text")
      .addColumn("userId", "uuid", (column) => column.notNull())
      .addColumn("purpose", "text", (column) => column.notNull())
      .addColumn("expiresAt", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("link_tokens_pkey", ["tokenHash"])
      .addForeignKeyConstraint("link_tokens_user_id_fkey", ["userId"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      )
      .addUniqueConstraint("link_tokens_user_id_purpose_key", ["userId", "purpose"]),
  );
});

// The links live an hour: dropping them loses nothing a User could not ask for again.
export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(db.schema.dropTable("link_tokens"));
});
