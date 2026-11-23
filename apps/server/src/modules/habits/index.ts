import { Layer } from "effect";

import { Habits } from "#/modules/habits/application/habits.ts";
import { HabitsHandlers } from "#/modules/habits/http/habits-handlers.ts";
import { HabitRepositoryPostgres } from "#/modules/habits/infrastructure/habit-repository-postgres.ts";

export const HabitsPostgres = HabitRepositoryPostgres;

export const HabitsModule = HabitsHandlers.pipe(Layer.provide(Habits.layer));
