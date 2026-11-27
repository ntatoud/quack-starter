import { Schema } from "effect";

import { Day } from "#/habits/day.ts";
import { Habit, HabitId } from "#/habits/habit.ts";

export class CheckIn extends Schema.Class<CheckIn, { readonly brand: unique symbol }>("CheckIn")({
  habitId: HabitId,
  day: Day,
}) {}

/** The Check-ins of a Habit a number of times a week in the week of Today, from its Monday, against that number. */
export class WeekProgress extends Schema.Class<WeekProgress, { readonly brand: unique symbol }>(
  "WeekProgress",
)({
  checkIns: Schema.Int,
  times: Schema.Int,
}) {}

export class TodayHabit extends Schema.Class<TodayHabit, { readonly brand: unique symbol }>(
  "TodayHabit",
)({
  habit: Habit,
  checkIn: Schema.NullOr(CheckIn),
  /** Null unless the Habit is due a number of times a week. */
  thisWeek: Schema.NullOr(WeekProgress),
}) {}

export class Today extends Schema.Class<Today, { readonly brand: unique symbol }>("Today")({
  day: Day,
  /** The Habits due on Today, a Habit a number of times a week until its week's count is reached. */
  habits: Schema.Array(TodayHabit),
  /** The Habits a number of times a week whose week's count is reached: they still take a Check-in. */
  doneThisWeek: Schema.Array(TodayHabit),
}) {}
