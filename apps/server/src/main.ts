import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { Database } from "#/database/database.ts";
import { IdentityPostgres } from "#/modules/identity/index.ts";
import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { TodosPostgres } from "#/modules/todos/index.ts";
import { ServerLayer } from "#/server.ts";

const Storage = Layer.mergeAll(IdentityPostgres, SessionStoreMemory, TodosPostgres);

Layer.launch(ServerLayer.pipe(Layer.provide(Storage), Layer.provide(Database))).pipe(
  NodeRuntime.runMain,
);
