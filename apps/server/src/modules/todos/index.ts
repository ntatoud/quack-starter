import { Layer } from "effect";

import { Todos } from "#/modules/todos/application/todos.ts";
import { TodosHandlers } from "#/modules/todos/http/todos-handlers.ts";
import { TodoRepositoryMemory } from "#/modules/todos/infrastructure/todo-repository-memory.ts";

export const TodosModule = TodosHandlers.pipe(
  Layer.provide(Todos.layer),
  Layer.provide(TodoRepositoryMemory),
);
