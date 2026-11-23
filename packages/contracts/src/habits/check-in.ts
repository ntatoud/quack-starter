import { Schema } from "effect";

import { Day } from "#/habits/day.ts";
import { Habit, HabitId } from "#/habits/habit.ts";

export class CheckIn extends Schema.Class<CheckIn, { readonly brand: unique symbol }>("CheckIn")({
  habitId: HabitId,
  day: Day,
}) {}

export class TodayHabit extends Schema.Class<TodayHabit, { readonly brand: unique symbol }>(
  "TodayHabit",
)({
  habit: Habit,
  checkIn: Schema.NullOr(CheckIn),
}) {}

/** The Habits due on the Current User's Today, in their order. */
export class Today extends Schema.Class<Today, { readonly brand: unique symbol }>("Today")({
  day: Day,
  habits: Schema.Array(TodayHabit),
}) {}
