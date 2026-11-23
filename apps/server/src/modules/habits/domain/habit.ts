import type { Day } from "@quack/contracts/habits/day";
import type { Habit, HabitVersion } from "@quack/contracts/habits/habit";
import { Array, Option } from "effect";

/** The version in force on the Day: the last one effective on it or before. None before the first Day. */
export const versionOn = (habit: Habit, day: Day): Option.Option<HabitVersion> =>
  Array.findLast(habit.versions, (version) => version.effectiveFrom <= day);

export const isDueOn = (habit: Habit, day: Day): boolean =>
  !habit.archived &&
  Option.match(versionOn(habit, day), {
    onNone: () => false,
    onSome: ({ schedule }) => schedule._tag === "EveryDay",
  });

export const canCheckInOn = (today: Day, day: Day): boolean => day === today;
