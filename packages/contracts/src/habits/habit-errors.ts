import { Schema } from "effect";

import { Day } from "#/habits/day.ts";
import { HabitId, Quantity, Target } from "#/habits/habit.ts";

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

/** The quantity of a Check-in does not fit the Target in force on its Day: a done Habit takes none, any other one. */
export class CheckInQuantityRefused extends Schema.TaggedError<
  CheckInQuantityRefused,
  { readonly brand: unique symbol }
>()("CheckInQuantityRefused", {
  target: Target,
  quantity: Schema.NullOr(Quantity),
}) {
  override get message() {
    return this.target._tag === "Done"
      ? "A Check-in of a done Habit holds no quantity"
      : `A Check-in of this Habit holds a quantity of ${this.target.unit}`;
  }
}
