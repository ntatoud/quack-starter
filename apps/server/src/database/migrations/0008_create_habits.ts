import { executor, postgres } from "@quack/effect-kysely/kysely";
import { Effect } from "effect";
import { sql } from "kysely";

const { schema } = postgres();

export default Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(
    schema
      .createTable("habits")
      .addColumn("id", "uuid")
      .addColumn("owner_id", "uuid", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("color", "text", (column) => column.notNull())
      .addColumn("position", "integer", (column) => column.notNull())
      .addColumn("archived", "boolean", (column) => column.notNull())
      .addColumn("first_day", "date", (column) => column.notNull())
      .addColumn("created_at", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("habits_pkey", ["id"])
      .addForeignKeyConstraint("habits_owner_id_fkey", ["owner_id"], "users", ["id"], (fk) =>
        fk.onDelete("cascade"),
      ),
  );
  yield* execute(schema.createIndex("habits_owner_id_idx").on("habits").column("owner_id"));
  yield* execute(
    schema
      .createTable("habit_versions")
      .addColumn("habit_id", "uuid", (column) => column.notNull())
      .addColumn("effective_from", "date", (column) => column.notNull())
      // A Schedule and a Target are tagged unions of the contract, stored as their JSON.
      .addColumn("schedule", "jsonb", (column) => column.notNull())
      .addColumn("target", "jsonb", (column) => column.notNull())
      .addPrimaryKeyConstraint("habit_versions_pkey", ["habit_id", "effective_from"])
      .addForeignKeyConstraint(
        "habit_versions_habit_id_fkey",
        ["habit_id"],
        "habits",
        ["id"],
        (fk) => fk.onDelete("cascade"),
      ),
  );
  yield* execute(
    schema
      .createTable("check_ins")
      .addColumn("habit_id", "uuid", (column) => column.notNull())
      .addColumn("day", "date", (column) => column.notNull())
      // The Day's total of a quantity Habit, null for a done one.
      .addColumn("quantity", "integer")
      .addCheckConstraint("check_ins_quantity_check", sql`quantity >= 0`)
      .addForeignKeyConstraint("check_ins_habit_id_fkey", ["habit_id"], "habits", ["id"], (fk) =>
        fk.onDelete("cascade"),
      )
      .addUniqueConstraint("check_ins_habit_id_day_key", ["habit_id", "day"]),
  );
});

export const down = Effect.gen(function* () {
  const execute = yield* executor;
  yield* execute(schema.dropTable("check_ins"));
  yield* execute(schema.dropTable("habit_versions"));
  yield* execute(schema.dropTable("habits"));
});
