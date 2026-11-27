import { Api } from "@quack/contracts/api";
import { CheckIn } from "@quack/contracts/habits/check-in";
import type { Day } from "@quack/contracts/habits/day";
import type { HabitId } from "@quack/contracts/habits/habit";
import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Habits } from "#/modules/habits/application/habits.ts";
import { today as todayOf } from "#/modules/identity/index.ts";

// The Owner and their Today: the server reads the Day from the clock in their time zone, never from the client.
const owner = Effect.gen(function* () {
  const user = yield* CurrentUser;

  return { ownerId: user.id, today: yield* todayOf(user) };
});

const checkInOf = ({ id, day }: { readonly id: HabitId; readonly day: Day }) =>
  new CheckIn({ habitId: id, day });

export const HabitsHandlers = HttpApiBuilder.group(
  Api,
  "habits",
  Effect.fn(function* (handlers) {
    const habits = yield* Habits;

    return handlers.handleAll({
      create: Effect.fn(function* ({ payload }) {
        const { ownerId, today } = yield* owner;

        return yield* habits.create(ownerId, today, payload);
      }),
      today: Effect.fn(function* () {
        const { ownerId, today } = yield* owner;

        return yield* habits.today(ownerId, today);
      }),
      checkIn: Effect.fn(function* ({ params }) {
        const { ownerId, today } = yield* owner;

        return yield* habits.checkIn(ownerId, today, checkInOf(params));
      }),
      uncheck: Effect.fn(function* ({ params }) {
        const { ownerId, today } = yield* owner;

        return yield* habits.uncheck(ownerId, today, checkInOf(params));
      }),
    });
  }),
);
