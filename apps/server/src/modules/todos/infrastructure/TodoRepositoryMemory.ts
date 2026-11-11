import { Effect, Layer, Option } from "effect";

import { type Todo, TodoId } from "@quack/contracts/todos/Todo";
import { TodoRepository } from "#/modules/todos/domain/TodoRepository.ts";

export const TodoRepositoryMemory = Layer.sync(TodoRepository, () => {
  const todos = new Map<TodoId, Todo>();

  return TodoRepository.of({
    nextId: Effect.sync(() => TodoId.make(crypto.randomUUID())),
    findAll: Effect.sync(() => Array.from(todos.values())),
    findById: (id) => Effect.sync(() => Option.fromNullishOr(todos.get(id))),
    save: (todo) => Effect.sync(() => void todos.set(todo.id, todo)),
    remove: (id) => Effect.sync(() => todos.delete(id)),
  });
});
