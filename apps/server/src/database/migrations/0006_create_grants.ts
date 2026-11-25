import { executor } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";
import { sql } from "kysely";
import { db } from "#/database/db.ts";

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    db.schema
      .createTable("grants")
      .addColumn("id", "uuid", (column) => column.defaultTo(sql`gen_random_uuid()`))
      .addColumn("userId", "uuid", (column) => column.notNull())
      .addColumn("aiClientId", "text", (column) => column.notNull())
      .addColumn("aiClientName", "text", (column) => column.notNull())
      .addColumn("redirectUri", "text", (column) => column.notNull())
      .addColumn("resource", "text", (column) => column.notNull())
      .addColumn("permissions", sql`text[]`, (column) => column.notNull())
      .addColumn("expiresAt", "timestamptz", (column) => column.notNull())
      .addColumn("lastUsedAt", "timestamptz")
      .addPrimaryKeyConstraint("grants_pkey", ["id"])
      .addForeignKeyConstraint("grants_user_id_fkey", ["userId"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      )
      .addUniqueConstraint("grants_user_id_ai_client_id_key", ["userId", "aiClientId"]),
  );
  yield* execute(
    db.schema
      .createTable("grant_access_tokens")
      .addColumn("tokenHash", "text")
      .addColumn("grantId", "uuid", (column) => column.notNull())
      .addColumn("resource", "text", (column) => column.notNull())
      .addColumn("permissions", sql`text[]`, (column) => column.notNull())
      .addColumn("expiresAt", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("grant_access_tokens_pkey", ["tokenHash"])
      .addForeignKeyConstraint(
        "grant_access_tokens_grant_id_fkey",
        ["grantId"],
        "grants",
        ["id"],
        (fk) => fk.onDelete("cascade"),
      ),
  );
  yield* execute(
    db.schema
      .createIndex("grant_access_tokens_grant_id_idx")
      .on("grant_access_tokens")
      .column("grantId"),
  );
  yield* execute(
    db.schema
      .createTable("grant_refresh_tokens")
      .addColumn("tokenHash", "text")
      .addColumn("grantId", "uuid", (column) => column.notNull())
      .addColumn("resource", "text", (column) => column.notNull())
      .addColumn("permissions", sql`text[]`, (column) => column.notNull())
      .addColumn("replaced", "boolean", (column) => column.notNull())
      .addPrimaryKeyConstraint("grant_refresh_tokens_pkey", ["tokenHash"])
      .addForeignKeyConstraint(
        "grant_refresh_tokens_grant_id_fkey",
        ["grantId"],
        "grants",
        ["id"],
        (fk) => fk.onDelete("cascade"),
      ),
  );
  yield* execute(
    db.schema
      .createIndex("grant_refresh_tokens_grant_id_idx")
      .on("grant_refresh_tokens")
      .column("grantId"),
  );
});

// An AI Client whose Grant goes asks its User to approve again: nothing is lost that the User cannot give back.
export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(db.schema.dropTable("grant_refresh_tokens"));
  yield* execute(db.schema.dropTable("grant_access_tokens"));
  yield* execute(db.schema.dropTable("grants"));
});
