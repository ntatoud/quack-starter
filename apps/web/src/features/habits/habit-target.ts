import type { Day } from "@quack/contracts/habits/day";
import { type Habit, Quantity, type Target } from "@quack/contracts/habits/habit";
import { Option, Schema } from "effect";

/**
 * The Target in force on the Day: that of the last version effective on it or before. Today lists a Habit from its
 * first Day only, when its first version is in force, so the fallback never shows a Target before it began.
 */
export const targetOn = (habit: Habit, day: Day): Target =>
  (habit.versions.findLast((version) => version.effectiveFrom <= day) ?? habit.versions[0]).target;

export type QuantityTarget = Exclude<Target, { _tag: "Done" }>;

export const describeTarget = ({ _tag, quantity, unit }: QuantityTarget) =>
  `${_tag === "AtLeast" ? "at least" : "at most"} ${quantity} ${unit}`;

const decodeQuantity = Schema.decodeUnknownOption(Quantity);

// An input gives text: a quantity is its digits only, so "1.5", "-1" or "1e3" is none.
export const typedQuantity = (typed: string): Option.Option<number> =>
  /^\d+$/.test(typed.trim()) ? decodeQuantity(Number(typed)) : Option.none();
