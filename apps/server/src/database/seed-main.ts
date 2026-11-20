import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

import { DatabaseConfig } from "#/config.ts";
import { seedDatabase } from "#/database/seed.ts";

Effect.flatMap(DatabaseConfig, seedDatabase).pipe(NodeRuntime.runMain);
