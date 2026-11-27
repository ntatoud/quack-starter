import { CheckIn, type CheckInEntry, Today, TodayHabit } from "@quack/contracts/habits/check-in";
import type { Day } from "@quack/contracts/habits/day";
import { Habit, type HabitId, HabitVersion, type NewHabit } from "@quack/contracts/habits/habit";
import {
  CheckInDayNotAllowed,
  CheckInQuantityRefused,
  HabitNotFound,
} from "@quack/contracts/habits/habit-errors";
import type { UserId } from "@quack/contracts/identity/user";
import { Array, Context, DateTime, Effect, Layer, Option } from "effect";

import { canCheckInOn, fitsTarget, isDueOn, versionOn } from "#/modules/habits/domain/habit.ts";
import { HabitRepository } from "#/modules/habits/domain/habit-repository.ts";

export class Habits extends Context.Service<
  Habits,
  {
    create(ownerId: UserId, today: Day, habit: NewHabit): Effect.Effect<Habit>;
    today(ownerId: UserId, today: Day): Effect.Effect<Today>;
    checkIn(
      ownerId: UserId,
      today: Day,
      habitId: HabitId,
      day: Day,
      entry: CheckInEntry,
    ): Effect.Effect<CheckIn, HabitNotFound | CheckInDayNotAllowed | CheckInQuantityRefused>;
    uncheck(
      ownerId: UserId,
      today: Day,
      habitId: HabitId,
      day: Day,
    ): Effect.Effect<void, HabitNotFound | CheckInDayNotAllowed>;
  }
>()("@quack/server/habits/Habits") {
  static readonly layer = Layer.effect(
    Habits,
    Effect.gen(function* () {
      const repository = yield* HabitRepository;

      // The Owner's Habit, and a Day it takes a Check-in on: another Owner's is not found, whatever the Day.
      const checkable = (ownerId: UserId, today: Day, habitId: HabitId, day: Day) =>
        Effect.gen(function* () {
          const habit = yield* repository.findById(ownerId, habitId);

          if (Option.isNone(habit)) {
            return yield* new HabitNotFound({ id: habitId });
          }

          if (!canCheckInOn(today, day)) {
            return yield* new CheckInDayNotAllowed({ day });
          }

          return habit.value;
        });

      return Habits.of({
        create: Effect.fn("Habits.create")(function* (
          ownerId,
          today,
          { schedule, target, ...rest },
        ) {
          const last = Array.last(yield* repository.findAll(ownerId));

          const habit = new Habit({
            ...rest,
            id: yield* repository.nextId,
            ownerId,
            position: Option.match(last, { onNone: () => 0, onSome: (h) => h.position + 1 }),
            archived: false,
            firstDay: today,
            createdAt: yield* DateTime.now,
            versions: [new HabitVersion({ effectiveFrom: today, schedule, target })],
          });

          yield* repository.create(habit);

          return habit;
        }),
        today: Effect.fn("Habits.today")(function* (ownerId, today) {
          const [habits, checkIns] = yield* Effect.all([
            repository.findAll(ownerId),
            repository.findCheckIns(ownerId, today),
          ]);

          return new Today({
            day: today,
            habits: habits
              .filter((habit) => isDueOn(habit, today))
              .map(
                (habit) =>
                  new TodayHabit({
                    habit,
                    checkIn: checkIns.find(({ habitId }) => habitId === habit.id) ?? null,
                  }),
              ),
          });
        }),
        checkIn: Effect.fn("Habits.checkIn")(function* (
          ownerId,
          today,
          habitId,
          day,
          { quantity },
        ) {
          const habit = yield* checkable(ownerId, today, habitId, day);
          // Before its first Day, a Habit has no Target to check in towards.
          const version = versionOn(habit, day);

          if (Option.isNone(version)) {
            return yield* new CheckInDayNotAllowed({ day });
          }

          const { target } = version.value;

          if (!fitsTarget(target, quantity)) {
            return yield* new CheckInQuantityRefused({ target, quantity });
          }

          const checkIn = new CheckIn({ habitId, day, quantity });
          yield* repository.saveCheckIn(checkIn);

          return checkIn;
        }),
        uncheck: Effect.fn("Habits.uncheck")(function* (ownerId, today, habitId, day) {
          yield* checkable(ownerId, today, habitId, day);
          yield* repository.removeCheckIn(habitId, day);
        }),
      });
    }),
  );
}
