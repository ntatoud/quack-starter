import type { UserId } from "@quack/contracts/identity/user";
import { type Todo, TodoId } from "@quack/contracts/todos/todo";
import { Array, DateTime, Effect, Layer, Option, Order, String } from "effect";

import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";

const byCreation = Order.combine(
  Order.mapInput(DateTime.Order, (todo: Todo) => todo.createdAt),
  Order.mapInput(String.Order, (todo: Todo) => todo.id),
);

export const TodoRepositoryMemory = Layer.sync(TodoRepository, () => {
  const todos = new Map<TodoId, Todo>();

  const ownedBy = (ownerId: UserId, id: TodoId) =>
    Option.fromNullishOr(todos.get(id)).pipe(Option.filter((todo) => todo.ownerId === ownerId));

  return TodoRepository.of({
    nextId: Effect.sync(() => TodoId.make(crypto.randomUUID())),
    findAll: (ownerId) =>
      Effect.sync(() =>
        Array.sort(
          Array.filter(todos.values(), (todo) => todo.ownerId === ownerId),
          byCreation,
        ),
      ),
    findById: (ownerId, id) => Effect.sync(() => ownedBy(ownerId, id)),
    save: (todo) => Effect.sync(() => void todos.set(todo.id, todo)),
    remove: (ownerId, id) =>
      Effect.sync(() => Option.isSome(ownedBy(ownerId, id)) && todos.delete(id)),
  });
});
