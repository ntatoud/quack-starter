import type { Day } from "@quack/contracts/habits/day";
import type { Habit, Target } from "@quack/contracts/habits/habit";

/** The Target in force on the Day: that of the last version effective on it or before. */
export const targetOn = (habit: Habit, day: Day): Target =>
  (habit.versions.findLast((version) => version.effectiveFrom <= day) ?? habit.versions[0]).target;

export type QuantityTarget = Exclude<Target, { _tag: "Done" }>;

export const describeTarget = ({ _tag, quantity, unit }: QuantityTarget) =>
  `${_tag === "AtLeast" ? "at least" : "at most"} ${quantity} ${unit}`;
