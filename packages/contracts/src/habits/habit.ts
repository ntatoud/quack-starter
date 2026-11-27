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

export const Schedule = Schema.TaggedUnion({ EveryDay: {} });

export type Schedule = typeof Schedule.Type;

// The largest value of a Postgres integer, which stores a quantity.
const largestQuantity = 2_147_483_647;

const isStorable = Schema.isLessThanOrEqualTo(largestQuantity, {
  message: "Enter a smaller number",
});

/** A whole number of 0 or more: a Day's total, or a Target to stay at most. */
export const Quantity = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0, { message: "Enter a whole number of 0 or more" }),
  isStorable,
);

export const HabitUnit = Schema.Trimmed.check(
  Schema.isNonEmpty({ message: "Unit is required" }),
  Schema.isMaxLength(16, { message: "Unit must be at most 16 characters" }),
).pipe(Schema.brand("HabitUnit"));

export type HabitUnit = typeof HabitUnit.Type;

export const Target = Schema.TaggedUnion({
  Done: {},
  AtLeast: {
    quantity: Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1, { message: "Enter a whole number of 1 or more" }),
      isStorable,
    ),
    unit: HabitUnit,
  },
  AtMost: { quantity: Quantity, unit: HabitUnit },
});

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
