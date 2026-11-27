import type { CheckIn } from "@quack/contracts/habits/check-in";
import { type Habit, HabitId } from "@quack/contracts/habits/habit";
import type { UserId } from "@quack/contracts/identity/user";
import { Array, Effect, Layer, Number, Option, Order, String } from "effect";

import { CheckInExists, HabitRepository } from "#/modules/habits/domain/habit-repository.ts";

const inOrder = Order.combine(
  Order.mapInput(Number.Order, (habit: Habit) => habit.position),
  Order.mapInput(String.Order, (habit: Habit) => habit.id),
);

const keyOf = ({ habitId, day }: CheckIn) => `${habitId}/${day}`;

const ownedBy = (ownerId: UserId) => (habit: Habit) => habit.ownerId === ownerId;

export const HabitRepositoryMemory = Layer.sync(HabitRepository, () => {
  const habits = new Map<HabitId, Habit>();
  const checkIns = new Map<string, CheckIn>();

  return HabitRepository.of({
    nextId: Effect.sync(() => HabitId.make(crypto.randomUUID())),
    findAll: (ownerId) =>
      Effect.sync(() => Array.sort(Array.filter(habits.values(), ownedBy(ownerId)), inOrder)),
    findById: (ownerId, id) =>
      Effect.sync(() => Option.fromNullishOr(habits.get(id)).pipe(Option.filter(ownedBy(ownerId)))),
    create: (habit) => Effect.sync(() => void habits.set(habit.id, habit)),
    findCheckIns: (ownerId, day) =>
      Effect.sync(() =>
        Array.filter(
          checkIns.values(),
          (checkIn) => checkIn.day === day && habits.get(checkIn.habitId)?.ownerId === ownerId,
        ),
      ),
    addCheckIn: (checkIn) =>
      checkIns.has(keyOf(checkIn))
        ? Effect.fail(new CheckInExists())
        : Effect.sync(() => void checkIns.set(keyOf(checkIn), checkIn)),
    removeCheckIn: (checkIn) => Effect.sync(() => void checkIns.delete(keyOf(checkIn))),
  });
});
