import type { CheckIn } from "@quack/contracts/habits/check-in";
import type { Day } from "@quack/contracts/habits/day";
import type { Habit, HabitId } from "@quack/contracts/habits/habit";
import type { UserId } from "@quack/contracts/identity/user";
import { Context, type Effect, type Option } from "effect";

export class HabitRepository extends Context.Service<
  HabitRepository,
  {
    readonly nextId: Effect.Effect<HabitId>;
    /** In their Owner's order, then by id. */
    findAll(ownerId: UserId): Effect.Effect<ReadonlyArray<Habit>>;
    findById(ownerId: UserId, id: HabitId): Effect.Effect<Option.Option<Habit>>;
    create(habit: Habit): Effect.Effect<void>;
    findCheckIns(ownerId: UserId, day: Day): Effect.Effect<ReadonlyArray<CheckIn>>;
    /** Replaces the Check-in of its Habit and Day, if any: one per Habit and Day. */
    saveCheckIn(checkIn: CheckIn): Effect.Effect<void>;
    removeCheckIn(habitId: HabitId, day: Day): Effect.Effect<void>;
  }
>()("@quack/server/habits/HabitRepository") {}
