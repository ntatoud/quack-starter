import { CheckIn, Today, TodayHabit } from "@quack/contracts/habits/check-in";
import type { Day } from "@quack/contracts/habits/day";
import { Habit, HabitVersion, type NewHabit } from "@quack/contracts/habits/habit";
import { CheckInDayNotAllowed, HabitNotFound } from "@quack/contracts/habits/habit-errors";
import type { UserId } from "@quack/contracts/identity/user";
import { Array, Context, DateTime, Effect, Layer, Option } from "effect";

import { canCheckInOn, isDueOn } from "#/modules/habits/domain/habit.ts";
import { HabitRepository } from "#/modules/habits/domain/habit-repository.ts";

export class Habits extends Context.Service<
  Habits,
  {
    create(ownerId: UserId, today: Day, habit: NewHabit): Effect.Effect<Habit>;
    today(ownerId: UserId, today: Day): Effect.Effect<Today>;
    checkIn(
      ownerId: UserId,
      today: Day,
      checkIn: CheckIn,
    ): Effect.Effect<CheckIn, HabitNotFound | CheckInDayNotAllowed>;
    uncheck(
      ownerId: UserId,
      today: Day,
      checkIn: CheckIn,
    ): Effect.Effect<void, HabitNotFound | CheckInDayNotAllowed>;
  }
>()("@quack/server/habits/Habits") {
  static readonly layer = Layer.effect(
    Habits,
    Effect.gen(function* () {
      const repository = yield* HabitRepository;

      // The Owner's Habit, and a Day it takes a Check-in on: another Owner's is not found, whatever the Day.
      const checkable = (ownerId: UserId, today: Day, { habitId, day }: CheckIn) =>
        Effect.gen(function* () {
          if (Option.isNone(yield* repository.findById(ownerId, habitId))) {
            return yield* new HabitNotFound({ id: habitId });
          }

          if (!canCheckInOn(today, day)) {
            return yield* new CheckInDayNotAllowed({ day });
          }
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
        checkIn: Effect.fn("Habits.checkIn")(function* (ownerId, today, checkIn) {
          yield* checkable(ownerId, today, checkIn);
          // A done Check-in holds nothing but its Day: the one there already is the same.
          yield* repository
            .addCheckIn(checkIn)
            .pipe(Effect.catchTag("CheckInExists", () => Effect.void));

          return checkIn;
        }),
        uncheck: Effect.fn("Habits.uncheck")(function* (ownerId, today, checkIn) {
          yield* checkable(ownerId, today, checkIn);
          yield* repository.removeCheckIn(checkIn);
        }),
      });
    }),
  );
}
