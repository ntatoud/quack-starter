import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

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

describe("NewHabit", () => {
  const decode = Schema.decodeUnknownOption(NewHabit);
  const meditate = { name: "Meditate", color: "teal" };

  it("accepts a Habit every Day whose Target is done", () => {
    expect(
      decode({ ...meditate, schedule: { _tag: "EveryDay" }, target: { _tag: "Done" } })._tag,
    ).toBe("Some");
  });

  it("refuses another Schedule or Target, and a color off the palette", () => {
    expect(
      decode({ ...meditate, schedule: { _tag: "Weekly" }, target: { _tag: "Done" } })._tag,
    ).toBe("None");
    expect(
      decode({ ...meditate, schedule: { _tag: "EveryDay" }, target: { _tag: "AtLeast" } })._tag,
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
