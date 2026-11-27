import { Schema } from "effect";

import { Day } from "#/habits/day.ts";
import { HabitId } from "#/habits/habit.ts";

export class HabitNotFound extends Schema.TaggedError<
  HabitNotFound,
  { readonly brand: unique symbol }
>()("HabitNotFound", {
  id: HabitId,
}) {
  override get message() {
    return `No Habit has the id ${this.id}`;
  }
}

/** A Check-in is written for Today only. */
export class CheckInDayNotAllowed extends Schema.TaggedError<
  CheckInDayNotAllowed,
  { readonly brand: unique symbol }
>()("CheckInDayNotAllowed", {
  day: Day,
}) {
  override get message() {
    return `A Check-in cannot be written for ${this.day}`;
  }
}
