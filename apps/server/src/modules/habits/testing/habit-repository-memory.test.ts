import { UserId } from "@quack/contracts/identity/user";
import { Effect } from "effect";

import { HabitRepositoryMemory } from "#/modules/habits/testing/habit-repository-memory.ts";
import { habitRepositorySuite } from "#/modules/habits/testing/habit-repository-suite.ts";

habitRepositorySuite(
  HabitRepositoryMemory,
  Effect.sync(() => UserId.make(crypto.randomUUID())),
);
