import {
  HabitColor,
  HabitName,
  IsoWeekday,
  type NewHabit,
  Schedule,
} from "@quack/contracts/habits/habit";
import { Schema } from "effect";

const named = {
  // Trimmed first: surrounding whitespace is not a mistake to report.
  name: Schema.Trim.pipe(Schema.decodeTo(HabitName)),
  color: Schema.String.pipe(Schema.decodeTo(HabitColor.annotate({ message: "Choose a color" }))),
};

// The fields of the other kinds of Schedule stay in the form, unchecked, so a change of kind keeps what was entered.
const days = Schema.Array(Schema.String);
const times = Schema.String;

/** What the form asks for: towards having done it, for now. A Schedule's own fields are checked for its kind only. */
export const HabitDraft = Schema.Union([
  Schema.Struct({ ...named, schedule: Schema.Literal("EveryDay"), days, times }),
  Schema.Struct({
    ...named,
    schedule: Schema.Literal("Weekdays"),
    days: Schema.Array(Schema.FiniteFromString.pipe(Schema.decodeTo(IsoWeekday))).check(
      Schema.isMinLength(1, { message: "Choose at least one day" }),
    ),
    times,
  }),
  Schema.Struct({
    ...named,
    schedule: Schema.Literal("Weekly"),
    days,
    times: Schema.FiniteFromString.pipe(Schema.decodeTo(Schema.Int)),
  }),
]);

// The draft checked the days of the week: the contract checks them again, as a non-empty list.
const decodeSchedule = Schema.decodeUnknownSync(Schedule);

const scheduleOf = (draft: typeof HabitDraft.Type): Schedule => {
  switch (draft.schedule) {
    case "EveryDay":
      return { _tag: "EveryDay" };
    case "Weekdays":
      return decodeSchedule({ _tag: "Weekdays", days: draft.days.toSorted((a, b) => a - b) });
    case "Weekly":
      return { _tag: "Weekly", times: draft.times };
  }
};

const decode = Schema.decodeSync(HabitDraft);

export const newHabitOf = (values: typeof HabitDraft.Encoded): NewHabit => {
  const draft = decode(values);

  return {
    name: draft.name,
    color: draft.color,
    schedule: scheduleOf(draft),
    target: { _tag: "Done" },
  };
};
