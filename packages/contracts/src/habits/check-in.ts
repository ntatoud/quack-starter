import { Schema } from "effect";

import { Day } from "#/habits/day.ts";
import { Habit, HabitId, Quantity } from "#/habits/habit.ts";

export class CheckIn extends Schema.Class<CheckIn, { readonly brand: unique symbol }>("CheckIn")({
  habitId: HabitId,
  day: Day,
  /** The Day's total of a quantity Habit, null for a done one. */
  quantity: Schema.NullOr(Quantity),
}) {}

/** What a Check-in records: the Day's total of a quantity Habit, or null for a done one. */
export const CheckInEntry = Schema.Struct({ quantity: Schema.NullOr(Quantity) });

export type CheckInEntry = typeof CheckInEntry.Type;

export class TodayHabit extends Schema.Class<TodayHabit, { readonly brand: unique symbol }>(
  "TodayHabit",
)({
  habit: Habit,
  checkIn: Schema.NullOr(CheckIn),
}) {}

export class Today extends Schema.Class<Today, { readonly brand: unique symbol }>("Today")({
  day: Day,
  habits: Schema.Array(TodayHabit),
}) {}
