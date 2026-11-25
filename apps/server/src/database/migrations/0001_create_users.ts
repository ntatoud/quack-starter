import { executor, postgres } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";
import { sql } from "kysely";

const { schema } = postgres();

export default Effect.gen(function* () {
  const execute = yield* executor;
  // An enum sorts in the order of its labels: alphabetical, as the list of Users sorts by status.
  yield* execute(schema.createType("user_status").asEnum(["active", "invited", "suspended"]));
  yield* execute(
    schema
      .createTable("users")
      .addColumn("id", "uuid")
      .addColumn("email", "text", (column) => column.notNull())
      .addColumn("password_hash", "text", (column) => column.notNull())
      .addColumn("role", "text", (column) => column.notNull())
      .addColumn("status", sql`user_status`, (column) => column.notNull())
      .addColumn("created_at", "timestamptz", (column) => column.notNull())
      .addColumn("last_sign_in_at", "timestamptz")
      .addColumn("onboarded_at", "timestamptz")
      // An IANA name, such as Europe/Paris.
      .addColumn("time_zone", "text", (column) => column.notNull())
      .addPrimaryKeyConstraint("users_pkey", ["id"])
      .addUniqueConstraint("users_email_key", ["email"]),
  );
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(schema.dropTable("users"));
  yield* execute(schema.dropType("user_status"));
});
