import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { SessionStoreMemory } from "#/modules/identity/infrastructure/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/infrastructure/user-repository-memory.ts";
import { TodoRepositoryMemory } from "#/modules/todos/infrastructure/todo-repository-memory.ts";
import { ServerLayer } from "#/server.ts";

const MemoryStorage = Layer.mergeAll(
  UserRepositoryMemory,
  SessionStoreMemory,
  TodoRepositoryMemory,
);

Layer.launch(ServerLayer.pipe(Layer.provide(MemoryStorage))).pipe(NodeRuntime.runMain);
