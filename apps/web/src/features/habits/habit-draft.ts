import { HabitColor, HabitName, HabitUnit, type Target } from "@quack/contracts/habits/habit";
import { Option, Schema } from "effect";

import { typedQuantity } from "#/features/habits/habit-target.ts";

const TargetKind = Schema.Literals(["Done", "AtLeast", "AtMost"]);

export const targetOptions = [
  { value: "Done", label: "Done" },
  { value: "AtLeast", label: "At least" },
  { value: "AtMost", label: "At most" },
] as const;

const isUnit = Schema.is(HabitUnit);

/**
 * What the form asks for: every Habit is due every Day, for now. A quantity and a unit count only for a quantity
 * Target, and are checked against its direction.
 */
export const HabitDraft = Schema.Struct({
  // Trimmed first: surrounding whitespace is not a mistake to report.
  name: Schema.Trim.pipe(Schema.decodeTo(HabitName)),
  color: Schema.String.pipe(Schema.decodeTo(HabitColor.annotate({ message: "Choose a color" }))),
  target: TargetKind,
  quantity: Schema.String,
  unit: Schema.Trim,
}).check(
  Schema.makeFilter(({ target, quantity, unit }) => {
    if (target === "Done") return undefined;

    const issues: Array<Schema.FilterIssue> = [];
    const value = typedQuantity(quantity);
    const lowest = target === "AtLeast" ? 1 : 0;

    if (Option.isNone(value)) {
      issues.push({
        path: ["quantity"],
        issue: quantity.trim() === "" ? "Quantity is required" : "Enter a whole number",
      });
    } else if (value.value < lowest) {
      issues.push({ path: ["quantity"], issue: `Enter a whole number of ${lowest} or more` });
    }

    if (!isUnit(unit)) {
      issues.push({
        path: ["unit"],
        issue: unit === "" ? "Unit is required" : "Unit must be at most 16 characters",
      });
    }

    return issues;
  }),
);

export type HabitDraft = typeof HabitDraft.Type;

/** The Target of a draft the schema accepted. */
export const targetOf = ({ target, quantity, unit }: HabitDraft): Target =>
  target === "Done"
    ? { _tag: "Done" }
    : {
        _tag: target,
        quantity: Option.getOrThrow(typedQuantity(quantity)),
        unit: HabitUnit.make(unit),
      };
