import type { UserId } from "@quack/contracts/identity/user";
import { type Todo, TodoId } from "@quack/contracts/todos/todo";
import { Effect, Layer, Option } from "effect";

import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";

export const TodoRepositoryMemory = Layer.sync(TodoRepository, () => {
  const todos = new Map<TodoId, Todo>();

  const ownedBy = (ownerId: UserId, id: TodoId) =>
    Option.fromNullishOr(todos.get(id)).pipe(Option.filter((todo) => todo.ownerId === ownerId));

  return TodoRepository.of({
    nextId: Effect.sync(() => TodoId.make(crypto.randomUUID())),
    findAll: (ownerId) =>
      Effect.sync(() => Array.from(todos.values()).filter((todo) => todo.ownerId === ownerId)),
    findById: (ownerId, id) => Effect.sync(() => ownedBy(ownerId, id)),
    save: (todo) => Effect.sync(() => void todos.set(todo.id, todo)),
    remove: (ownerId, id) =>
      Effect.sync(() => Option.isSome(ownedBy(ownerId, id)) && todos.delete(id)),
  });
});
