import type { CheckIn } from "@quack/contracts/habits/check-in";
import { Day } from "@quack/contracts/habits/day";
import type { Habit, HabitVersion, IsoWeekday } from "@quack/contracts/habits/habit";
import { Array, DateTime, Option } from "effect";

/** The version in force on the Day: the last one effective on it or before. None before the first Day. */
export const versionOn = (habit: Habit, day: Day): Option.Option<HabitVersion> =>
  Array.findLast(habit.versions, (version) => version.effectiveFrom <= day);

// A Day is a date with no zone: read in UTC, it stays the same date.
const asUtc = (day: Day) => DateTime.makeUnsafe(`${day}T00:00:00Z`);

// `weekDay` counts from 0 for Sunday, which the ISO week numbers 7.
const isoWeekdayOf = (day: Day): IsoWeekday => DateTime.getPartUtc(asUtc(day), "weekDay") || 7;

/** The Monday of the Day's week: weeks are ISO weeks. */
export const mondayOf = (day: Day): Day =>
  Day.make(DateTime.formatIsoDateUtc(DateTime.startOf(asUtc(day), "week", { weekStartsOn: 1 })));

export const isDueOn = (habit: Habit, day: Day): boolean =>
  !habit.archived &&
  Option.match(versionOn(habit, day), {
    onNone: () => false,
    onSome: ({ schedule }) => {
      switch (schedule._tag) {
        case "EveryDay":
        case "Weekly":
          return true;
        case "Weekdays":
          return schedule.days.includes(isoWeekdayOf(day));
      }
    },
  });

/**
 * For a Habit a number of times a week on the Day, its Check-ins from the Monday of the Day's week to the Day, and
 * that number. `checkIns` holds the Habit's Check-ins of that week, and may hold others'.
 */
export const weekProgressOn = (
  habit: Habit,
  day: Day,
  checkIns: ReadonlyArray<CheckIn>,
): Option.Option<{ readonly checkIns: number; readonly times: number }> =>
  versionOn(habit, day).pipe(
    Option.flatMap(({ schedule }) =>
      schedule._tag === "Weekly" ? Option.some(schedule.times) : Option.none(),
    ),
    Option.map((times) => {
      const monday = mondayOf(day);

      return {
        checkIns: checkIns.filter(
          (checkIn) => checkIn.habitId === habit.id && checkIn.day >= monday && checkIn.day <= day,
        ).length,
        times,
      };
    }),
  );

export const canCheckInOn = (today: Day, day: Day): boolean => day === today;
