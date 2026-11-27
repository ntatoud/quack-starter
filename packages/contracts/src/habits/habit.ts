import { Schema } from "effect";

import { Day } from "#/habits/day.ts";
import { UserId } from "#/identity/user.ts";

export const HabitId = Schema.String.pipe(Schema.brand("HabitId"));

export type HabitId = typeof HabitId.Type;

export const HabitName = Schema.Trimmed.check(
  Schema.isNonEmpty({ message: "Name is required" }),
  Schema.isMaxLength(60, { message: "Name must be at most 60 characters" }),
).pipe(Schema.brand("HabitName"));

export type HabitName = typeof HabitName.Type;

/** A name of the palette, not a CSS color: each client draws it in its own theme. */
export const HabitColor = Schema.Literals([
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "violet",
  "pink",
]);

export type HabitColor = typeof HabitColor.Type;

/** 1 for Monday to 7 for Sunday. */
export const IsoWeekday = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 7 }));

export type IsoWeekday = typeof IsoWeekday.Type;

export const Schedule = Schema.TaggedUnion({
  EveryDay: {},
  Weekdays: {
    days: Schema.NonEmptyArray(IsoWeekday).check(
      Schema.isUnique({ message: "Choose each day once" }),
    ),
  },
  Weekly: { times: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 7 })) },
});

export type Schedule = typeof Schedule.Type;

export const Target = Schema.TaggedUnion({ Done: {} });

export type Target = typeof Target.Type;

/** The Schedule and Target of a Habit from the Day it takes effect, until the next version's. ADR 0006. */
export class HabitVersion extends Schema.Class<HabitVersion, { readonly brand: unique symbol }>(
  "HabitVersion",
)({
  effectiveFrom: Day,
  schedule: Schedule,
  target: Target,
}) {}

export class Habit extends Schema.Class<Habit, { readonly brand: unique symbol }>("Habit")({
  id: HabitId,
  ownerId: UserId,
  name: HabitName,
  color: HabitColor,
  /** Where the Habit stands in its Owner's order, from 0. */
  position: Schema.Int,
  archived: Schema.Boolean,
  /** Today for its Owner when they created it: no Day before it counts. */
  firstDay: Day,
  createdAt: Schema.DateTimeUtcFromString,
  /** Oldest first, the first one effective on the first Day. */
  versions: Schema.NonEmptyArray(HabitVersion),
}) {}

export const NewHabit = Schema.Struct({
  name: HabitName,
  color: HabitColor,
  schedule: Schedule,
  target: Target,
});

export type NewHabit = typeof NewHabit.Type;
