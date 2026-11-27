import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { CheckInEntry } from "#/habits/check-in.ts";
import { Day } from "#/habits/day.ts";
import { Habit, HabitId, HabitName, HabitVersion, NewHabit } from "#/habits/habit.ts";
import { UserId } from "#/identity/user.ts";

describe("HabitName", () => {
  it("rejects empty, untrimmed, and overlong names", () => {
    const decode = Schema.decodeUnknownOption(HabitName);

    expect(decode("Meditate")._tag).toBe("Some");
    expect(decode("")._tag).toBe("None");
    expect(decode(" Meditate ")._tag).toBe("None");
    expect(decode("x".repeat(61))._tag).toBe("None");
  });
});

/** A Target as a client may send it, right or wrong. */
type TargetInput = { readonly _tag: string; readonly quantity?: number; readonly unit?: string };

describe("NewHabit", () => {
  const decode = Schema.decodeUnknownOption(NewHabit);
  const meditate = { name: "Meditate", color: "teal" };

  it("accepts a Habit every Day whose Target is done", () => {
    expect(
      decode({ ...meditate, schedule: { _tag: "EveryDay" }, target: { _tag: "Done" } })._tag,
    ).toBe("Some");
  });

  it("accepts a quantity Target, at least 1 or at most 0, in a unit of 1 to 16 characters", () => {
    const withTarget = (target: TargetInput) =>
      decode({ ...meditate, schedule: { _tag: "EveryDay" }, target })._tag;

    expect(withTarget({ _tag: "AtLeast", quantity: 8, unit: "glasses" })).toBe("Some");
    expect(withTarget({ _tag: "AtLeast", quantity: 1, unit: "x".repeat(16) })).toBe("Some");
    expect(withTarget({ _tag: "AtMost", quantity: 0, unit: "cigarettes" })).toBe("Some");
    expect(withTarget({ _tag: "AtMost", quantity: 2, unit: "coffees" })).toBe("Some");
  });

  it("refuses a quantity Target that is not whole, too low, or without a fitting unit", () => {
    const withTarget = (target: TargetInput) =>
      decode({ ...meditate, schedule: { _tag: "EveryDay" }, target })._tag;

    expect(withTarget({ _tag: "AtLeast", quantity: 0, unit: "glasses" })).toBe("None");
    expect(withTarget({ _tag: "AtLeast", quantity: 1.5, unit: "glasses" })).toBe("None");
    expect(withTarget({ _tag: "AtMost", quantity: -1, unit: "coffees" })).toBe("None");
    expect(withTarget({ _tag: "AtMost", quantity: 2, unit: "" })).toBe("None");
    expect(withTarget({ _tag: "AtMost", quantity: 2, unit: " coffees " })).toBe("None");
    expect(withTarget({ _tag: "AtMost", quantity: 2, unit: "x".repeat(17) })).toBe("None");
    expect(withTarget({ _tag: "AtLeast", unit: "glasses" })).toBe("None");
  });

  it("refuses another Schedule or Target, and a color off the palette", () => {
    expect(
      decode({ ...meditate, schedule: { _tag: "Weekly" }, target: { _tag: "Done" } })._tag,
    ).toBe("None");
    expect(
      decode({ ...meditate, schedule: { _tag: "EveryDay" }, target: { _tag: "Daily" } })._tag,
    ).toBe("None");
    expect(
      decode({
        ...meditate,
        color: "#ff0000",
        schedule: { _tag: "EveryDay" },
        target: { _tag: "Done" },
      })._tag,
    ).toBe("None");
  });
});

describe("Habit", () => {
  it("round-trips through its wire format", () => {
    const habit = new Habit({
      id: HabitId.make("habit-1"),
      ownerId: UserId.make("user-1"),
      name: HabitName.make("Meditate"),
      color: "teal",
      position: 0,
      archived: false,
      firstDay: Day.make("2026-06-01"),
      createdAt: DateTime.makeUnsafe("2026-06-01T08:00:00Z"),
      versions: [
        new HabitVersion({
          effectiveFrom: Day.make("2026-06-01"),
          schedule: { _tag: "EveryDay" },
          target: { _tag: "Done" },
        }),
      ],
    });

    const wire = Schema.encodeSync(Habit)(habit);
    expect(wire.createdAt).toBe("2026-06-01T08:00:00.000Z");
    expect(Schema.decodeSync(Habit)(wire)).toStrictEqual(habit);
  });
});

describe("CheckInEntry", () => {
  it("holds a whole number of 0 or more, or null", () => {
    const decode = Schema.decodeUnknownOption(CheckInEntry);

    expect(decode({ quantity: 0 })._tag).toBe("Some");
    expect(decode({ quantity: 12 })._tag).toBe("Some");
    expect(decode({ quantity: null })._tag).toBe("Some");
    expect(decode({ quantity: -1 })._tag).toBe("None");
    expect(decode({ quantity: 1.5 })._tag).toBe("None");
  });
});
