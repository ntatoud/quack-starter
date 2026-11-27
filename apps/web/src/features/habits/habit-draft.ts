import {
  HabitColor,
  HabitName,
  HabitUnit,
  Quantity,
  type Target,
} from "@quack/contracts/habits/habit";
import { Schema } from "effect";

const TargetKind = Schema.Literals(["Done", "AtLeast", "AtMost"]);

export const targetOptions = [
  { value: "Done", label: "Done" },
  { value: "AtLeast", label: "At least" },
  { value: "AtMost", label: "At most" },
] as const;

const isQuantity = Schema.is(Quantity);
const isUnit = Schema.is(HabitUnit);

// An input gives text: a quantity is its digits only, so "1.5" or "1e3" is no whole number.
const quantityOf = (typed: string) => (/^\d+$/.test(typed.trim()) ? Number(typed) : Number.NaN);

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
    const value = quantityOf(quantity);
    const lowest = target === "AtLeast" ? 1 : 0;

    if (!isQuantity(value)) {
      issues.push({
        path: ["quantity"],
        issue: quantity.trim() === "" ? "Quantity is required" : "Enter a whole number",
      });
    } else if (value < lowest) {
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
    : { _tag: target, quantity: quantityOf(quantity), unit: HabitUnit.make(unit) };
