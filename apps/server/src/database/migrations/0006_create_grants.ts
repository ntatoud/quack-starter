import { executor, postgres } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";
import { sql } from "kysely";

const { schema } = postgres();

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    schema
      .createTable("grants")
      .addColumn("id", "uuid", (column) => column.defaultTo(sql`gen_random_uuid()`))
      .addColumn("user_id", "uuid", (column) => column.notNull())
      .addColumn("ai_client_id", "text", (column) => column.notNull())
      .addColumn("ai_client_name", "text", (column) => column.notNull())
      .addColumn("redirect_uri", "text", (column) => column.notNull())
      .addColumn("resource", "text", (column) => column.notNull())
      .addColumn("permissions", sql`text[]`, (column) => column.notNull())
      .addColumn("expires_at", "timestamptz", (column) => column.notNull())
      .addColumn("last_used_at", "timestamptz")
      .addPrimaryKeyConstraint("grants_pkey", ["id"])
      .addForeignKeyConstraint("grants_user_id_fkey", ["user_id"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      )
      .addUniqueConstraint("grants_user_id_ai_client_id_key", ["user_id", "ai_client_id"]),
  );
  yield* execute(
    schema
      .createTable("grant_access_tokens")
      .addColumn("token_hash", "text")
      .addColumn("grant_id", "uuid", (column) => column.notNull())
      .addColumn("resource", "text", (column) => column.notNull())
      .addColumn("permissions", sql`text[]`, (column) => column.notNull())
      .addColumn("expires_at", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("grant_access_tokens_pkey", ["token_hash"])
      .addForeignKeyConstraint(
        "grant_access_tokens_grant_id_fkey",
        ["grant_id"],
        "grants",
        ["id"],
        (fk) => fk.onDelete("cascade"),
      ),
  );
  yield* execute(
    schema
      .createIndex("grant_access_tokens_grant_id_idx")
      .on("grant_access_tokens")
      .column("grant_id"),
  );
  yield* execute(
    schema
      .createTable("grant_refresh_tokens")
      .addColumn("token_hash", "text")
      .addColumn("grant_id", "uuid", (column) => column.notNull())
      .addColumn("resource", "text", (column) => column.notNull())
      .addColumn("permissions", sql`text[]`, (column) => column.notNull())
      .addColumn("replaced", "boolean", (column) => column.notNull())
      .addPrimaryKeyConstraint("grant_refresh_tokens_pkey", ["token_hash"])
      .addForeignKeyConstraint(
        "grant_refresh_tokens_grant_id_fkey",
        ["grant_id"],
        "grants",
        ["id"],
        (fk) => fk.onDelete("cascade"),
      ),
  );
  yield* execute(
    schema
      .createIndex("grant_refresh_tokens_grant_id_idx")
      .on("grant_refresh_tokens")
      .column("grant_id"),
  );
});

// An AI Client whose Grant goes asks its User to approve again: nothing is lost that the User cannot give back.
export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(schema.dropTable("grant_refresh_tokens"));
  yield* execute(schema.dropTable("grant_access_tokens"));
  yield* execute(schema.dropTable("grants"));
});
