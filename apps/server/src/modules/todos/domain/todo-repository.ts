import { Context, type Effect, type Option } from "effect";

import type { Todo, TodoId } from "@quack/contracts/todos/todo";

/** Port. The domain owns the interface; infrastructure provides the Layer. */
export class TodoRepository extends Context.Service<
  TodoRepository,
  {
    readonly nextId: Effect.Effect<TodoId>;
    readonly findAll: Effect.Effect<ReadonlyArray<Todo>>;
    findById(id: TodoId): Effect.Effect<Option.Option<Todo>>;
    save(todo: Todo): Effect.Effect<void>;
    /** Succeeds with `false` when no todo has this id. */
    remove(id: TodoId): Effect.Effect<boolean>;
  }
>()("@quack/server/todos/TodoRepository") {}
