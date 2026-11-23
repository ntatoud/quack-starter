import { HabitColor, HabitName } from "@quack/contracts/habits/habit";
import { Schema } from "effect";

/** What the form asks for: every Habit is due every Day, towards having done it, for now. */
export const HabitDraft = Schema.Struct({
  // Trimmed first: surrounding whitespace is not a mistake to report.
  name: Schema.Trim.pipe(Schema.decodeTo(HabitName)),
  color: Schema.String.pipe(Schema.decodeTo(HabitColor.annotate({ message: "Choose a color" }))),
});
