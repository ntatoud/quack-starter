import { CheckIn } from "@quack/contracts/habits/check-in";
import { Day } from "@quack/contracts/habits/day";
import { Habit, HabitId } from "@quack/contracts/habits/habit";
import { UserId } from "@quack/contracts/identity/user";
import { Effect, Layer, Option, Schema } from "effect";
import { executor } from "@quack/effect-kysely/kysely";
import { SqlClient, SqlSchema } from "effect/sql";
import { type ExpressionBuilder, sql as kysely } from "kysely";
import { jsonBuildObject } from "kysely/helpers/postgres";

import { db, type Tables } from "#/database/db.ts";

import { CheckInExists, HabitRepository } from "#/modules/habits/domain/habit-repository.ts";

const HabitResult = Schema.Struct({ habit: Habit });

const OwnedHabit = Schema.Struct({ ownerId: UserId, id: HabitId });

const OwnedDay = Schema.Struct({ ownerId: UserId, day: Day });

// The column is a uuid: Postgres refuses any other id, which no Habit can have.
const isStorableId = Schema.is(Schema.String.check(Schema.isUUID()));

// kysely-codegen types a date column as a Date; a Day is its text, which Postgres reads as the same date.
const asDate = (day: string) => kysely<Date>`${day}::date`;

// Built as the encoded Habit, so the contract's schema decodes it, versions and Days included.
const habitJson = (eb: ExpressionBuilder<Tables, "habits">) =>
  jsonBuildObject({
    id: eb.ref("id"),
    ownerId: eb.ref("ownerId"),
    name: eb.ref("name"),
    color: eb.ref("color"),
    position: eb.ref("position"),
    archived: eb.ref("archived"),
    firstDay: eb.ref("firstDay"),
    createdAt: eb.ref("createdAt"),
    versions: eb
      .selectFrom("habitVersions")
      .select((version) =>
        version.fn
          .jsonAgg(
            jsonBuildObject({
              effectiveFrom: version.ref("effectiveFrom"),
              schedule: version.ref("schedule"),
              target: version.ref("target"),
            }),
          )
          .orderBy("effectiveFrom")
          .as("versions"),
      )
      .whereRef("habitVersions.habitId", "=", "habits.id"),
  });

const selectHabits = db
  .selectFrom("habits")
  .select((eb) => habitJson(eb).as("habit"))
  .orderBy("position")
  .orderBy("id");

export const HabitRepositoryPostgres = Layer.effect(
  HabitRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const execute = yield* executor;

    const findAll = SqlSchema.findAll({
      Request: UserId,
      Result: HabitResult,
      execute: (ownerId) => execute(selectHabits.where("ownerId", "=", ownerId)),
    });

    const findById = SqlSchema.findOneOption({
      Request: OwnedHabit,
      Result: HabitResult,
      execute: ({ ownerId, id }) =>
        execute(selectHabits.where("ownerId", "=", ownerId).where("id", "=", id)),
    });

    const insert = SqlSchema.void({
      Request: Habit,
      execute: ({ versions, ...habit }) =>
        execute(db.insertInto("habits").values(habit)).pipe(
          Effect.andThen(
            execute(
              db.insertInto("habitVersions").values(
                versions.map((version) => ({
                  habitId: habit.id,
                  effectiveFrom: version.effectiveFrom,
                  schedule: JSON.stringify(version.schedule),
                  target: JSON.stringify(version.target),
                })),
              ),
            ),
          ),
          sql.withTransaction,
        ),
    });

    const findCheckIns = SqlSchema.findAll({
      Request: OwnedDay,
      Result: CheckIn,
      execute: ({ ownerId, day }) =>
        execute(
          db
            .selectFrom("checkIns")
            .innerJoin("habits", "habits.id", "checkIns.habitId")
            .select(["checkIns.habitId", "checkIns.day"])
            .where("habits.ownerId", "=", ownerId)
            .where("checkIns.day", "=", asDate(day)),
        ),
    });

    const insertCheckIn = SqlSchema.void({
      Request: CheckIn,
      execute: (checkIn) => execute(db.insertInto("checkIns").values(checkIn)),
    });

    const deleteCheckIn = SqlSchema.void({
      Request: CheckIn,
      execute: ({ habitId, day }) =>
        execute(
          db.deleteFrom("checkIns").where("habitId", "=", habitId).where("day", "=", asDate(day)),
        ),
    });

    return HabitRepository.of({
      nextId: Effect.sync(() => HabitId.make(crypto.randomUUID())),
      findAll: Effect.fn("HabitRepository.findAll")((ownerId) =>
        findAll(ownerId).pipe(
          Effect.map((rows) => rows.map(({ habit }) => habit)),
          Effect.orDie,
        ),
      ),
      findById: Effect.fn("HabitRepository.findById")((ownerId, id) =>
        isStorableId(id)
          ? findById({ ownerId, id }).pipe(
              Effect.map((row) => row.pipe(Option.map(({ habit }) => habit))),
              Effect.orDie,
            )
          : Effect.succeedNone,
      ),
      create: Effect.fn("HabitRepository.create")((habit) => insert(habit).pipe(Effect.orDie)),
      findCheckIns: Effect.fn("HabitRepository.findCheckIns")((ownerId, day) =>
        findCheckIns({ ownerId, day }).pipe(Effect.orDie),
      ),
      addCheckIn: Effect.fn("HabitRepository.addCheckIn")((checkIn) =>
        insertCheckIn(checkIn).pipe(
          Effect.catchTags({
            SqlError: (error) =>
              error.reason._tag === "UniqueViolation" &&
              error.reason.constraint === "check_ins_habit_id_day_key"
                ? Effect.fail(new CheckInExists())
                : Effect.die(error),
            SchemaError: Effect.die,
          }),
        ),
      ),
      removeCheckIn: Effect.fn("HabitRepository.removeCheckIn")((checkIn) =>
        deleteCheckIn(checkIn).pipe(Effect.orDie),
      ),
    });
  }),
);
