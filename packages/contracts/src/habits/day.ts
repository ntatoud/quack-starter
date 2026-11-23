import { Schema } from "effect";

const message = "Enter a date, like 2026-06-01";

// A date the calendar lacks, such as 2026-02-30, comes back from `Date` as another day.
const isOnCalendar = (day: string) => {
  const midnight = new Date(`${day}T00:00:00Z`);

  return !Number.isNaN(midnight.getTime()) && midnight.toISOString().startsWith(day);
};

export const Day = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/, { message }),
  Schema.makeFilter(isOnCalendar, { message }),
).pipe(Schema.brand("Day"));

export type Day = typeof Day.Type;
