import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Day } from "@quack/contracts/habits/day";
import { HabitId, HabitName, HabitUnit, type NewHabit } from "@quack/contracts/habits/habit";
import {
  CheckInDayNotAllowed,
  CheckInQuantityRefused,
  HabitNotFound,
} from "@quack/contracts/habits/habit-errors";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Email, type TimeZone, User, UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect, Layer } from "effect";
import { HttpClientRequest, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";

import { HabitsModule } from "#/modules/habits/index.ts";
import { HabitRepositoryMemory } from "#/modules/habits/testing/habit-repository-memory.ts";
import { authenticationByUserId } from "#/modules/identity/testing/authentication-by-user-id.ts";

const aUser = (id: string, timeZone: TimeZone) =>
  new User({
    id: UserId.make(id),
    email: Email.make(`${id}@example.com`),
    role: "user",
    status: "active",
    createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
    lastSignInAt: null,
    onboardedAt: null,
    timeZone,
    profile: null,
  });

const paris = DateTime.zoneMakeNamedUnsafe("Europe/Paris");
const newYork = DateTime.zoneMakeNamedUnsafe("America/New_York");

const ada = aUser("ada", paris);
const grace = aUser("grace", paris);
const alan = aUser("alan", newYork);

const clientOf = (user: User) =>
  HttpApiTest.groups(Api, ["habits"]).pipe(
    Effect.provide(
      HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
        next(HttpClientRequest.setHeader(request, "cookie", `session=${user.id}`)),
      ),
    ),
  );

const at = (iso: string) => TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(iso)));

// What a Check-in of a done Habit records.
const none = { quantity: null };

const water: NewHabit = {
  name: HabitName.make("Water"),
  color: "blue",
  schedule: { _tag: "EveryDay" },
  target: { _tag: "AtLeast", quantity: 8, unit: HabitUnit.make("glasses") },
};

const smoking: NewHabit = {
  name: HabitName.make("No smoking"),
  color: "red",
  schedule: { _tag: "EveryDay" },
  target: { _tag: "AtMost", quantity: 0, unit: HabitUnit.make("cigarettes") },
};

const meditate: NewHabit = {
  name: HabitName.make("Meditate"),
  color: "teal",
  schedule: { _tag: "EveryDay" },
  target: { _tag: "Done" },
};

const HabitsLayer = HabitsModule.pipe(
  Layer.provide(HabitRepositoryMemory),
  Layer.provideMerge(authenticationByUserId([ada, grace, alan])),
);

layer(Layer.mergeAll(HabitsLayer, HttpServer.layerServices))("HabitsApi", (it) => {
  it.effect("creates a Habit of the Current User, every Day and done, from their Today", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);

      const habit = yield* client.habits.create({ payload: meditate });

      assert.strictEqual(habit.ownerId, ada.id);
      assert.strictEqual(habit.name, "Meditate");
      assert.strictEqual(habit.color, "teal");
      assert.isFalse(habit.archived);
      assert.strictEqual(habit.firstDay, "2026-06-01");
      assert.deepStrictEqual<unknown>(
        habit.versions.map(({ effectiveFrom, schedule, target }) => ({
          effectiveFrom,
          schedule,
          target,
        })),
        [{ effectiveFrom: "2026-06-01", schedule: { _tag: "EveryDay" }, target: { _tag: "Done" } }],
      );
    }),
  );

  it.effect("puts a new Habit at the end of its Owner's order", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);

      const first = yield* client.habits.create({ payload: meditate });

      const second = yield* client.habits.create({
        payload: { ...meditate, name: HabitName.make("Read") },
      });

      assert.strictEqual(second.position, first.position + 1);
      const order = (yield* client.habits.today()).habits.map(({ habit }) => habit.id);
      assert.isBelow(order.indexOf(first.id), order.indexOf(second.id));
    }),
  );

  it.effect("starts a Habit on the Day it is where its Owner lives", () =>
    Effect.gen(function* () {
      // Already the 2nd in Paris, still the 1st in New York.
      yield* at("2026-06-01T23:30:00Z");

      const inParis = yield* (yield* clientOf(ada)).habits.create({ payload: meditate });
      const inNewYork = yield* (yield* clientOf(alan)).habits.create({ payload: meditate });

      assert.strictEqual(inParis.firstDay, "2026-06-02");
      assert.strictEqual(inNewYork.firstDay, "2026-06-01");
    }),
  );

  it.effect("lists a new Habit on Today, not checked in yet", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: meditate });

      const today = yield* client.habits.today();

      assert.strictEqual(today.day, "2026-06-01");
      const entry = today.habits.find((due) => due.habit.id === habit.id);
      assert.deepStrictEqual(entry?.habit, habit);
      assert.isNull(entry?.checkIn);
    }),
  );

  it.effect("keeps a Habit due on the Days after its first one", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: meditate });

      yield* at("2026-06-09T08:00:00Z");
      const today = yield* client.habits.today();

      assert.strictEqual(today.day, "2026-06-09");
      assert.include(
        today.habits.map((due) => due.habit.id),
        habit.id,
      );
    }),
  );

  it.effect("checks a Habit in for Today, and unchecks it", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: meditate });
      const params = { id: habit.id, day: Day.make("2026-06-01") };

      const checkIn = yield* client.habits.checkIn({ params, payload: none });

      assert.deepStrictEqual(
        { ...checkIn },
        { habitId: habit.id, day: "2026-06-01", quantity: null },
      );

      const checked = (yield* client.habits.today()).habits.find(
        (due) => due.habit.id === habit.id,
      );

      assert.deepStrictEqual(checked?.checkIn, checkIn);

      yield* client.habits.uncheck({ params });

      const unchecked = (yield* client.habits.today()).habits.find(
        (due) => due.habit.id === habit.id,
      );

      assert.isNull(unchecked?.checkIn);
    }),
  );

  it.effect("keeps one Check-in per Habit and Day: a second one replaces the first", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: meditate });
      const params = { id: habit.id, day: Day.make("2026-06-01") };

      yield* client.habits.checkIn({ params, payload: none });
      const again = yield* client.habits.checkIn({ params, payload: none });

      assert.deepStrictEqual(
        { ...again },
        { habitId: habit.id, day: "2026-06-01", quantity: null },
      );
      yield* client.habits.uncheck({ params });
      const today = yield* client.habits.today();
      assert.isNull(today.habits.find((due) => due.habit.id === habit.id)?.checkIn);
    }),
  );

  it.effect("records the Day's total of an at-least Habit, a new total replacing the last", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: water });
      const params = { id: habit.id, day: Day.make("2026-06-01") };

      const first = yield* client.habits.checkIn({ params, payload: { quantity: 3 } });
      const second = yield* client.habits.checkIn({ params, payload: { quantity: 5 } });

      assert.deepStrictEqual<unknown>(habit.versions[0]?.target, {
        _tag: "AtLeast",
        quantity: 8,
        unit: "glasses",
      });
      assert.strictEqual(first.quantity, 3);
      assert.deepStrictEqual({ ...second }, { habitId: habit.id, day: "2026-06-01", quantity: 5 });
      const today = yield* client.habits.today();
      assert.deepStrictEqual(
        today.habits.find((due) => due.habit.id === habit.id)?.checkIn,
        second,
      );
    }),
  );

  it.effect("keeps a total of 0 of an at-most Habit as a Check-in", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: smoking });
      const params = { id: habit.id, day: Day.make("2026-06-01") };

      yield* client.habits.checkIn({ params, payload: { quantity: 2 } });
      yield* client.habits.checkIn({ params, payload: { quantity: 0 } });

      const today = yield* client.habits.today();
      assert.deepStrictEqual(
        { ...today.habits.find((due) => due.habit.id === habit.id)?.checkIn },
        { habitId: habit.id, day: "2026-06-01", quantity: 0 },
      );
    }),
  );

  it.effect(
    "refuses a Check-in without a total for a quantity Habit, with one for a done Habit",
    () =>
      Effect.gen(function* () {
        yield* at("2026-06-01T08:00:00Z");
        const client = yield* clientOf(ada);
        const day = Day.make("2026-06-01");
        const drinking = yield* client.habits.create({ payload: water });
        const quitting = yield* client.habits.create({ payload: smoking });
        const meditating = yield* client.habits.create({ payload: meditate });

        const noTotal = yield* client.habits
          .checkIn({ params: { id: drinking.id, day }, payload: none })
          .pipe(Effect.flip);

        const noTotalAtMost = yield* client.habits
          .checkIn({ params: { id: quitting.id, day }, payload: none })
          .pipe(Effect.flip);

        const aTotal = yield* client.habits
          .checkIn({ params: { id: meditating.id, day }, payload: { quantity: 1 } })
          .pipe(Effect.flip);

        const response = yield* client.habits.checkIn({
          params: { id: meditating.id, day },
          payload: { quantity: 1 },
          responseMode: "response-only",
        });

        assert.deepStrictEqual(
          noTotal,
          new CheckInQuantityRefused({ target: water.target, quantity: null }),
        );
        assert.deepStrictEqual(
          noTotalAtMost,
          new CheckInQuantityRefused({ target: smoking.target, quantity: null }),
        );
        assert.deepStrictEqual(
          aTotal,
          new CheckInQuantityRefused({ target: meditate.target, quantity: 1 }),
        );
        assert.strictEqual(response.status, 422);

        const checkIns = (yield* client.habits.today()).habits
          .filter((due) => [drinking.id, quitting.id, meditating.id].includes(due.habit.id))
          .map((due) => due.checkIn);

        assert.deepStrictEqual(checkIns, [null, null, null]);
      }),
  );

  it.effect("unchecks a Habit not checked in as a no-op", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: meditate });

      const response = yield* client.habits.uncheck({
        params: { id: habit.id, day: Day.make("2026-06-01") },
        responseMode: "response-only",
      });

      assert.strictEqual(response.status, 204);
    }),
  );

  it.effect("checks in on the Day it is where the Owner lives, and refuses another", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T12:00:00Z");
      const client = yield* clientOf(alan);
      const habit = yield* client.habits.create({ payload: meditate });

      // Already the 2nd in Paris and in UTC, still the 1st in New York.
      yield* at("2026-06-02T02:00:00Z");
      const tomorrow = Day.make("2026-06-02");

      const refused = yield* client.habits
        .checkIn({ params: { id: habit.id, day: tomorrow }, payload: none })
        .pipe(Effect.flip);

      const response = yield* client.habits.checkIn({
        params: { id: habit.id, day: tomorrow },
        payload: none,
        responseMode: "response-only",
      });

      const checkIn = yield* client.habits.checkIn({
        params: { id: habit.id, day: Day.make("2026-06-01") },
        payload: none,
      });

      assert.deepStrictEqual(refused, new CheckInDayNotAllowed({ day: tomorrow }));
      assert.strictEqual(response.status, 422);
      assert.strictEqual(checkIn.day, "2026-06-01");
    }),
  );

  it.effect("refuses to check in or uncheck a Day before Today", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: meditate });
      yield* at("2026-06-02T08:00:00Z");
      const params = { id: habit.id, day: Day.make("2026-06-01") };

      const checkIn = yield* client.habits.checkIn({ params, payload: none }).pipe(Effect.flip);
      const uncheck = yield* client.habits.uncheck({ params }).pipe(Effect.flip);

      assert.deepStrictEqual(checkIn, new CheckInDayNotAllowed({ day: params.day }));
      assert.deepStrictEqual(uncheck, new CheckInDayNotAllowed({ day: params.day }));
    }),
  );

  it.effect("lets another User neither see, check in, nor uncheck a Habit: it is not found", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const asAda = yield* clientOf(ada);
      const asGrace = yield* clientOf(grace);
      const habit = yield* asAda.habits.create({ payload: meditate });
      const params = { id: habit.id, day: Day.make("2026-06-01") };

      const seenByGrace = (yield* asGrace.habits.today()).habits.map((due) => due.habit.id);
      const checkIn = yield* asGrace.habits.checkIn({ params, payload: none }).pipe(Effect.flip);

      const checkInResponse = yield* asGrace.habits.checkIn({
        params,
        payload: none,
        responseMode: "response-only",
      });

      const uncheck = yield* asGrace.habits.uncheck({ params }).pipe(Effect.flip);

      const uncheckResponse = yield* asGrace.habits.uncheck({
        params,
        responseMode: "response-only",
      });

      assert.notInclude(seenByGrace, habit.id);
      assert.deepStrictEqual(checkIn, new HabitNotFound({ id: habit.id }));
      assert.strictEqual(checkInResponse.status, 404);
      assert.deepStrictEqual(uncheck, new HabitNotFound({ id: habit.id }));
      assert.strictEqual(uncheckResponse.status, 404);
      const ofAda = (yield* asAda.habits.today()).habits.find((due) => due.habit.id === habit.id);
      assert.isNull(ofAda?.checkIn);
    }),
  );

  it.effect("fails with HabitNotFound for an unknown id", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const id = HabitId.make("missing");

      const error = yield* client.habits
        .checkIn({ params: { id, day: Day.make("2026-06-01") }, payload: none })
        .pipe(Effect.flip);

      assert.deepStrictEqual(error, new HabitNotFound({ id }));
    }),
  );
});
