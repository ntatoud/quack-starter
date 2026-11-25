import { executor } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";
import { sql } from "kysely";
import { db } from "#/database/db.ts";

export default Effect.gen(function* () {
  const execute = yield* executor;
  // An enum sorts in the order of its labels: alphabetical, as the list of Users sorts by status.
  yield* execute(db.schema.createType("user_status").asEnum(["active", "invited", "suspended"]));
  yield* execute(
    db.schema
      .createTable("users")
      .addColumn("id", "uuid")
      .addColumn("email", "text", (column) => column.notNull())
      .addColumn("passwordHash", "text", (column) => column.notNull())
      .addColumn("role", "text", (column) => column.notNull())
      .addColumn("status", sql`user_status`, (column) => column.notNull())
      .addColumn("createdAt", "timestamptz", (column) => column.notNull())
      .addColumn("lastSignInAt", "timestamptz")
      .addColumn("onboardedAt", "timestamptz")
      // An IANA name, such as Europe/Paris.
      .addColumn("timeZone", "text", (column) => column.notNull())
      .addPrimaryKeyConstraint("users_pkey", ["id"])
      .addUniqueConstraint("users_email_key", ["email"]),
  );
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(db.schema.dropTable("users"));
  yield* execute(db.schema.dropType("user_status"));
});
