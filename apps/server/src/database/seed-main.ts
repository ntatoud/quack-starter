import { NodeRuntime } from "@effect/platform-node";

import { seedDatabase } from "#/database/seed.ts";

seedDatabase.pipe(NodeRuntime.runMain);
