import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

import { DatabaseConfig } from "#/config.ts";
import { seedDatabase } from "#/database/seed.ts";
import { ConsoleLogger } from "#/observability.ts";

Effect.flatMap(DatabaseConfig, seedDatabase).pipe(
  Effect.provide(ConsoleLogger),
  NodeRuntime.runMain,
);
