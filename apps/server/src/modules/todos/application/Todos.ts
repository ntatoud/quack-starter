import { Todo, type TodoId, type TodoTitle } from "@quack/contracts/todos/Todo";
import { TodoNotFound } from "@quack/contracts/todos/TodoErrors";
import { Context, DateTime, Effect, Layer, Option } from "effect";

import { completeTodo } from "#/modules/todos/domain/Todo.ts";
import { TodoRepository } from "#/modules/todos/domain/TodoRepository.ts";

/** Use cases of the todos context. Depends on the domain only. */
export class Todos extends Context.Service<
  Todos,
  {
    readonly list: Effect.Effect<ReadonlyArray<Todo>>;
    create(title: TodoTitle): Effect.Effect<Todo>;
    complete(id: TodoId): Effect.Effect<Todo, TodoNotFound>;
    remove(id: TodoId): Effect.Effect<void, TodoNotFound>;
  }
>()("@quack/server/todos/Todos") {
  static readonly layer = Layer.effect(
    Todos,
    Effect.gen(function* () {
      const repository = yield* TodoRepository;

      const create = Effect.fn("Todos.create")(function* (title: TodoTitle) {
        const todo = new Todo({
          id: yield* repository.nextId,
          title,
          completed: false,
          createdAt: yield* DateTime.now,
        });
        yield* repository.save(todo);
        return todo;
      });

      const complete = Effect.fn("Todos.complete")(function* (id: TodoId) {
        const found = yield* repository.findById(id);
        if (Option.isNone(found)) {
          return yield* new TodoNotFound({ id });
        }
        const completed = completeTodo(found.value);
        yield* repository.save(completed);
        return completed;
      });

      const remove = Effect.fn("Todos.remove")(function* (id: TodoId) {
        const removed = yield* repository.remove(id);
        if (!removed) {
          return yield* new TodoNotFound({ id });
        }
      });

      return Todos.of({ list: repository.findAll, create, complete, remove });
    }),
  );
}
