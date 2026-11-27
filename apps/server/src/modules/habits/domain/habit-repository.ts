import type { CheckIn } from "@quack/contracts/habits/check-in";
import type { Day } from "@quack/contracts/habits/day";
import type { Habit, HabitId } from "@quack/contracts/habits/habit";
import type { UserId } from "@quack/contracts/identity/user";
import { Context, type Effect, type Option, Schema } from "effect";

/** The Habit has a Check-in on that Day already: one per Habit and Day. */
export class CheckInExists extends Schema.TaggedError<
  CheckInExists,
  { readonly brand: unique symbol }
>()("CheckInExists", {}) {}

export class HabitRepository extends Context.Service<
  HabitRepository,
  {
    readonly nextId: Effect.Effect<HabitId>;
    /** In their Owner's order, then by id. */
    findAll(ownerId: UserId): Effect.Effect<ReadonlyArray<Habit>>;
    findById(ownerId: UserId, id: HabitId): Effect.Effect<Option.Option<Habit>>;
    create(habit: Habit): Effect.Effect<void>;
    /** Both Days included. */
    findCheckIns(ownerId: UserId, from: Day, to: Day): Effect.Effect<ReadonlyArray<CheckIn>>;
    addCheckIn(checkIn: CheckIn): Effect.Effect<void, CheckInExists>;
    removeCheckIn(checkIn: CheckIn): Effect.Effect<void>;
  }
>()("@quack/server/habits/HabitRepository") {}
