import { Schema } from "effect";

/** A calendar date in the time zone of a User, as `YYYY-MM-DD`: never an instant. */
export const Day = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/, { message: "Enter a date, like 2026-06-01" }),
).pipe(Schema.brand("Day"));

export type Day = typeof Day.Type;
