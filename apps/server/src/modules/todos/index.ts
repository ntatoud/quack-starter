import { Layer } from "effect";

import { Todos } from "#/modules/todos/application/Todos.ts";
import { TodosHandlers } from "#/modules/todos/http/TodosHandlers.ts";
import { TodoRepositoryMemory } from "#/modules/todos/infrastructure/TodoRepositoryMemory.ts";

/** Composition of the todos context: handlers, use cases, and the chosen adapters. */
export const TodosModule = TodosHandlers.pipe(
  Layer.provide(Todos.layer),
  Layer.provide(TodoRepositoryMemory),
);
