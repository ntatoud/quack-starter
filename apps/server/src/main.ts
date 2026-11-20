import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { Database } from "#/database/database.ts";
import { IdentityPostgres } from "#/modules/identity/index.ts";
import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { TodoRepositoryMemory } from "#/modules/todos/infrastructure/todo-repository-memory.ts";
import { ServerLayer } from "#/server.ts";

const Storage = Layer.mergeAll(IdentityPostgres, SessionStoreMemory, TodoRepositoryMemory);

Layer.launch(ServerLayer.pipe(Layer.provide(Storage), Layer.provide(Database))).pipe(
  NodeRuntime.runMain,
);
