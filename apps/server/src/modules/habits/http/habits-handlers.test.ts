import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Day } from "@quack/contracts/habits/day";
import type { Today, TodayHabit } from "@quack/contracts/habits/check-in";
import { HabitId, HabitName, type IsoWeekday, type NewHabit } from "@quack/contracts/habits/habit";
import { CheckInDayNotAllowed, HabitNotFound } from "@quack/contracts/habits/habit-errors";
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
      assert.deepStrictEqual(
        habit.versions.map(({ effectiveFrom, schedule, target }) => ({
          effectiveFrom,
          schedule,
          target,
        })),
        [
          {
            effectiveFrom: Day.make("2026-06-01"),
            schedule: { _tag: "EveryDay" },
            target: { _tag: "Done" },
          },
        ],
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

      const checkIn = yield* client.habits.checkIn({ params });

      assert.deepStrictEqual({ ...checkIn }, { habitId: habit.id, day: "2026-06-01" });

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

      yield* client.habits.checkIn({ params });
      const again = yield* client.habits.checkIn({ params });

      assert.deepStrictEqual({ ...again }, { habitId: habit.id, day: "2026-06-01" });
      yield* client.habits.uncheck({ params });
      const today = yield* client.habits.today();
      assert.isNull(today.habits.find((due) => due.habit.id === habit.id)?.checkIn);
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
        .checkIn({ params: { id: habit.id, day: tomorrow } })
        .pipe(Effect.flip);

      const response = yield* client.habits.checkIn({
        params: { id: habit.id, day: tomorrow },
        responseMode: "response-only",
      });

      const checkIn = yield* client.habits.checkIn({
        params: { id: habit.id, day: Day.make("2026-06-01") },
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

      const checkIn = yield* client.habits.checkIn({ params }).pipe(Effect.flip);
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
      const checkIn = yield* asGrace.habits.checkIn({ params }).pipe(Effect.flip);

      const checkInResponse = yield* asGrace.habits.checkIn({
        params,
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
        .checkIn({ params: { id, day: Day.make("2026-06-01") } })
        .pipe(Effect.flip);

      assert.deepStrictEqual(error, new HabitNotFound({ id }));
    }),
  );

  // 2026-06-01 is a Monday.
  const onDays = (...days: readonly [IsoWeekday, ...Array<IsoWeekday>]): NewHabit => ({
    ...meditate,
    name: HabitName.make("Run"),
    schedule: { _tag: "Weekdays", days },
  });

  const timesAWeek = (times: number): NewHabit => ({
    ...meditate,
    name: HabitName.make("Swim"),
    schedule: { _tag: "Weekly", times },
  });

  const sectionsOf = (today: Today, id: HabitId) => ({
    due: today.habits.find((entry) => entry.habit.id === id),
    doneThisWeek: today.doneThisWeek.find((entry) => entry.habit.id === id),
  });

  it.effect("lists a Habit on some days of the week on those days only", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: onDays(1, 3, 5) });

      const listedOn = function* (iso: string) {
        yield* at(iso);
        const today = yield* client.habits.today();

        return today.habits.some((entry) => entry.habit.id === habit.id);
      };

      assert.isTrue(yield* listedOn("2026-06-01T08:00:00Z"));
      assert.isFalse(yield* listedOn("2026-06-02T08:00:00Z"));
      assert.isTrue(yield* listedOn("2026-06-03T08:00:00Z"));
      assert.isFalse(yield* listedOn("2026-06-04T08:00:00Z"));
      assert.isTrue(yield* listedOn("2026-06-05T08:00:00Z"));
      assert.isFalse(yield* listedOn("2026-06-06T08:00:00Z"));
      assert.isFalse(yield* listedOn("2026-06-07T08:00:00Z"));
      assert.isTrue(yield* listedOn("2026-06-08T08:00:00Z"));
    }),
  );

  it.effect("reads the days of the week where the Owner lives", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(alan);
      const habit = yield* client.habits.create({ payload: onDays(7) });

      // Already Monday the 8th in UTC, still Sunday the 7th in New York.
      yield* at("2026-06-08T02:00:00Z");
      const today = yield* client.habits.today();

      assert.strictEqual(today.day, "2026-06-07");
      assert.include(
        today.habits.map((entry) => entry.habit.id),
        habit.id,
      );
      assert.isNull(sectionsOf(today, habit.id).due?.thisWeek);
    }),
  );

  it.effect("accepts and keeps a Check-in on a Day a Habit is not due", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: onDays(1) });
      yield* at("2026-06-02T08:00:00Z");
      const params = { id: habit.id, day: Day.make("2026-06-02") };

      const checkIn = yield* client.habits.checkIn({ params });
      const again = yield* client.habits.checkIn({ params, responseMode: "response-only" });

      assert.deepStrictEqual({ ...checkIn }, { habitId: habit.id, day: "2026-06-02" });
      assert.strictEqual(again.status, 200);
    }),
  );

  it.effect(
    "lists a Habit a number of times a week every Day, with its progress, until its count is reached",
    () =>
      Effect.gen(function* () {
        yield* at("2026-06-01T08:00:00Z");
        const client = yield* clientOf(ada);
        const habit = yield* client.habits.create({ payload: timesAWeek(2) });

        type Progress = { checkIns: number; times: number } | null;

        const progressOn = function* (iso: string, day: string, checkIn: boolean) {
          yield* at(iso);

          if (checkIn)
            yield* client.habits.checkIn({ params: { id: habit.id, day: Day.make(day) } });
          const { due, doneThisWeek } = sectionsOf(yield* client.habits.today(), habit.id);

          const progress = (entry: TodayHabit | undefined): Progress =>
            entry?.thisWeek ? { ...entry.thisWeek } : null;

          return { due: progress(due), doneThisWeek: progress(doneThisWeek) };
        };

        assert.deepStrictEqual(yield* progressOn("2026-06-01T08:00:00Z", "2026-06-01", false), {
          due: { checkIns: 0, times: 2 },
          doneThisWeek: null,
        });
        assert.deepStrictEqual(yield* progressOn("2026-06-01T09:00:00Z", "2026-06-01", true), {
          due: { checkIns: 1, times: 2 },
          doneThisWeek: null,
        });
        assert.deepStrictEqual(yield* progressOn("2026-06-03T08:00:00Z", "2026-06-03", false), {
          due: { checkIns: 1, times: 2 },
          doneThisWeek: null,
        });
        assert.deepStrictEqual(yield* progressOn("2026-06-03T09:00:00Z", "2026-06-03", true), {
          due: null,
          doneThisWeek: { checkIns: 2, times: 2 },
        });
        assert.deepStrictEqual(yield* progressOn("2026-06-07T08:00:00Z", "2026-06-07", false), {
          due: null,
          doneThisWeek: { checkIns: 2, times: 2 },
        });
        // A new week starts on Monday.
        assert.deepStrictEqual(yield* progressOn("2026-06-08T08:00:00Z", "2026-06-08", false), {
          due: { checkIns: 0, times: 2 },
          doneThisWeek: null,
        });
      }),
  );

  it.effect("lets a Habit done this week be checked in again, and counts it", () =>
    Effect.gen(function* () {
      yield* at("2026-06-01T08:00:00Z");
      const client = yield* clientOf(ada);
      const habit = yield* client.habits.create({ payload: timesAWeek(1) });
      yield* client.habits.checkIn({ params: { id: habit.id, day: Day.make("2026-06-01") } });

      yield* at("2026-06-02T08:00:00Z");
      const before = sectionsOf(yield* client.habits.today(), habit.id).doneThisWeek;
      yield* client.habits.checkIn({ params: { id: habit.id, day: Day.make("2026-06-02") } });
      const after = sectionsOf(yield* client.habits.today(), habit.id).doneThisWeek;

      assert.isNull(before?.checkIn);
      assert.deepStrictEqual({ ...after?.thisWeek }, { checkIns: 2, times: 1 });
      assert.deepStrictEqual({ ...after?.checkIn }, { habitId: habit.id, day: "2026-06-02" });
    }),
  );

  it.effect("starts the week on Monday where the Owner lives", () =>
    Effect.gen(function* () {
      yield* at("2026-06-06T12:00:00Z");
      const client = yield* clientOf(alan);
      const habit = yield* client.habits.create({ payload: timesAWeek(1) });
      yield* client.habits.checkIn({ params: { id: habit.id, day: Day.make("2026-06-06") } });

      // Already Monday the 8th in UTC, still Sunday the 7th in New York.
      yield* at("2026-06-08T02:00:00Z");
      const sunday = sectionsOf(yield* client.habits.today(), habit.id);
      // Monday the 8th in New York.
      yield* at("2026-06-08T05:00:00Z");
      const monday = sectionsOf(yield* client.habits.today(), habit.id);

      assert.deepStrictEqual({ ...sunday.doneThisWeek?.thisWeek }, { checkIns: 1, times: 1 });
      assert.deepStrictEqual({ ...monday.due?.thisWeek }, { checkIns: 0, times: 1 });
    }),
  );
});
