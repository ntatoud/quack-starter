import type { UserId } from "@quack/contracts/identity/user";
import { Todo, type TodoId, type TodoTitle } from "@quack/contracts/todos/todo";
import { TodoNotFound } from "@quack/contracts/todos/todo-errors";
import { Context, DateTime, Effect, Layer, Option } from "effect";

import { completeTodo } from "#/modules/todos/domain/todo.ts";
import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";

/** Use cases of the todos context. Depends on the domain only. */
export class Todos extends Context.Service<
  Todos,
  {
    list(ownerId: UserId): Effect.Effect<ReadonlyArray<Todo>>;
    create(ownerId: UserId, title: TodoTitle): Effect.Effect<Todo>;
    complete(ownerId: UserId, id: TodoId): Effect.Effect<Todo, TodoNotFound>;
    remove(ownerId: UserId, id: TodoId): Effect.Effect<void, TodoNotFound>;
  }
>()("@quack/server/todos/Todos") {
  static readonly layer = Layer.effect(
    Todos,
    Effect.gen(function* () {
      const repository = yield* TodoRepository;

      return Todos.of({
        list: repository.findAll,
        create: Effect.fn("Todos.create")(function* (ownerId, title) {
          const todo = new Todo({
            id: yield* repository.nextId,
            ownerId,
            title,
            completed: false,
            createdAt: yield* DateTime.now,
          });
          yield* repository.save(todo);
          return todo;
        }),
        complete: Effect.fn("Todos.complete")(function* (ownerId, id) {
          const found = yield* repository.findById(ownerId, id);
          if (Option.isNone(found)) {
            return yield* new TodoNotFound({ id });
          }
          const completed = completeTodo(found.value);
          yield* repository.save(completed);
          return completed;
        }),
        remove: Effect.fn("Todos.remove")(function* (ownerId, id) {
          const removed = yield* repository.remove(ownerId, id);
          if (!removed) {
            return yield* new TodoNotFound({ id });
          }
        }),
      });
    }),
  );
}
