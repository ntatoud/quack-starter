import { assert, describe, it } from "@effect/vitest";
import { CheckIn } from "@quack/contracts/habits/check-in";
import { Day } from "@quack/contracts/habits/day";
import { Habit, HabitId, HabitName, HabitVersion } from "@quack/contracts/habits/habit";
import type { UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect, type Layer, Option } from "effect";

import { HabitRepository } from "#/modules/habits/domain/habit-repository.ts";

const firstDay = Day.make("2026-06-01");

const aHabit = (fields: Partial<Habit> & Pick<Habit, "id" | "ownerId">) =>
  new Habit({
    name: HabitName.make("Meditate"),
    color: "teal",
    position: 0,
    archived: false,
    firstDay,
    createdAt: DateTime.makeUnsafe("2026-06-01T08:00:00Z"),
    versions: [
      new HabitVersion({
        effectiveFrom: firstDay,
        schedule: { _tag: "EveryDay" },
        target: { _tag: "Done" },
      }),
    ],
    ...fields,
  });

const aSavedHabit = (ownerId: UserId, fields: Partial<Habit> = {}) =>
  Effect.gen(function* () {
    const repository = yield* HabitRepository;
    const habit = aHabit({ id: yield* repository.nextId, ownerId, ...fields });
    yield* repository.create(habit);

    return habit;
  });

const idsInOrder = (ownerId: UserId) =>
  Effect.gen(function* () {
    const habits = yield* (yield* HabitRepository).findAll(ownerId);

    return habits.map(({ id }) => id);
  });

const aCheckIn = (ownerId: UserId) =>
  Effect.gen(function* () {
    const habit = yield* aSavedHabit(ownerId);
    const checkIn = new CheckIn({ habitId: habit.id, day: firstDay, quantity: null });
    yield* (yield* HabitRepository).saveCheckIn(checkIn);

    return checkIn;
  });

/**
 * The promises of a `HabitRepository`. `anOwner` gives a User the adapter can store Habits of: an adapter that
 * persists keeps the data of the tests before, so each test has its own Owners.
 */
export const habitRepositorySuite = <R>(
  layer: Layer.Layer<HabitRepository | R>,
  anOwner: Effect.Effect<UserId, never, R>,
) => {
  const test = (name: string, body: () => Effect.Effect<void, never, HabitRepository | R>) =>
    it.effect(name, () => body().pipe(Effect.provide(layer)));

  describe("HabitRepository", () => {
    test("gives a new id each time", () =>
      Effect.gen(function* () {
        const repository = yield* HabitRepository;

        assert.notStrictEqual(yield* repository.nextId, yield* repository.nextId);
      }));

    test("finds a created Habit, with its versions, by its Owner and id", () =>
      Effect.gen(function* () {
        const repository = yield* HabitRepository;
        const owner = yield* anOwner;
        const habit = yield* aSavedHabit(owner);

        assert.deepStrictEqual(yield* repository.findById(owner, habit.id), Option.some(habit));
      }));

    test("does not find a Habit of another Owner", () =>
      Effect.gen(function* () {
        const repository = yield* HabitRepository;
        const habit = yield* aSavedHabit(yield* anOwner);

        assert.isTrue(Option.isNone(yield* repository.findById(yield* anOwner, habit.id)));
      }));

    test("finds nothing for an id it did not give", () =>
      Effect.gen(function* () {
        const repository = yield* HabitRepository;

        assert.isTrue(
          Option.isNone(yield* repository.findById(yield* anOwner, HabitId.make("not-an-id"))),
        );
      }));

    test("lists the Habits of an Owner in their order, then by id", () =>
      Effect.gen(function* () {
        const repository = yield* HabitRepository;
        const owner = yield* anOwner;
        const last = aHabit({ id: yield* repository.nextId, ownerId: owner, position: 2 });
        const first = aHabit({ id: yield* repository.nextId, ownerId: owner, position: 0 });
        const second = aHabit({ id: yield* repository.nextId, ownerId: owner, position: 1 });

        yield* Effect.forEach([last, second, first], repository.create);
        yield* aSavedHabit(yield* anOwner);

        assert.deepStrictEqual(yield* idsInOrder(owner), [first.id, second.id, last.id]);
      }));

    test("breaks a tie of position by id", () =>
      Effect.gen(function* () {
        const repository = yield* HabitRepository;
        const owner = yield* anOwner;
        const ids = [yield* repository.nextId, yield* repository.nextId].toSorted();

        yield* Effect.forEach(ids.toReversed(), (id) =>
          repository.create(aHabit({ id, ownerId: owner })),
        );

        assert.deepStrictEqual(yield* idsInOrder(owner), ids);
      }));

    test("finds the Check-ins of an Owner's Habits on a Day, and no other", () =>
      Effect.gen(function* () {
        const repository = yield* HabitRepository;
        const owner = yield* anOwner;
        const [habit, other] = [yield* aSavedHabit(owner), yield* aSavedHabit(owner)];
        const ofAnotherOwner = yield* aSavedHabit(yield* anOwner);
        const onTheDay = new CheckIn({ habitId: habit.id, day: firstDay, quantity: null });
        const onOther = new CheckIn({ habitId: other.id, day: firstDay, quantity: 3 });

        yield* repository.saveCheckIn(onTheDay);
        yield* repository.saveCheckIn(onOther);
        yield* repository.saveCheckIn(
          new CheckIn({ habitId: habit.id, day: Day.make("2026-06-02"), quantity: null }),
        );
        yield* repository.saveCheckIn(
          new CheckIn({ habitId: ofAnotherOwner.id, day: firstDay, quantity: null }),
        );

        const found = yield* repository.findCheckIns(owner, firstDay);

        assert.sameDeepMembers([...found], [onTheDay, onOther]);
      }));

    test("keeps one Check-in per Habit and Day, the last one saved, a total of 0 included", () =>
      Effect.gen(function* () {
        const repository = yield* HabitRepository;
        const owner = yield* anOwner;
        const habit = yield* aSavedHabit(owner);
        const last = new CheckIn({ habitId: habit.id, day: firstDay, quantity: 0 });

        yield* repository.saveCheckIn(
          new CheckIn({ habitId: habit.id, day: firstDay, quantity: 4 }),
        );
        yield* repository.saveCheckIn(last);

        assert.deepStrictEqual(yield* repository.findCheckIns(owner, firstDay), [last]);
      }));

    test("removes a Check-in, and nothing for a Day without one", () =>
      Effect.gen(function* () {
        const repository = yield* HabitRepository;
        const owner = yield* anOwner;
        const checkIn = yield* aCheckIn(owner);

        yield* repository.removeCheckIn(checkIn.habitId, checkIn.day);
        yield* repository.removeCheckIn(checkIn.habitId, checkIn.day);

        assert.deepStrictEqual(yield* repository.findCheckIns(owner, firstDay), []);
      }));
  });
};
