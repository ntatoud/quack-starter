import { executor } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";
import { sql } from "kysely";

import { db } from "#/database/db.ts";

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    db.schema
      .createTable("authorization_codes")
      .addColumn("codeHash", "text")
      .addColumn("userId", "uuid", (column) => column.notNull())
      .addColumn("aiClientId", "text", (column) => column.notNull())
      .addColumn("aiClientName", "text", (column) => column.notNull())
      .addColumn("redirectUri", "text", (column) => column.notNull())
      .addColumn("resource", "text", (column) => column.notNull())
      .addColumn("permissions", sql`text[]`, (column) => column.notNull())
      .addColumn("codeChallenge", "text", (column) => column.notNull())
      .addColumn("expiresAt", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("authorization_codes_pkey", ["codeHash"])
      .addForeignKeyConstraint(
        "authorization_codes_user_id_fkey",
        ["userId"],
        "users",
        ["id"],
        (fk) => fk.onDelete("cascade"),
      ),
  );
  yield* execute(
    db.schema
      .createIndex("authorization_codes_user_id_idx")
      .on("authorization_codes")
      .column("userId"),
  );
});

// The codes live a minute: dropping them loses nothing an AI Client could not ask for again.
export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(db.schema.dropTable("authorization_codes"));
});
