import { Context, type Effect, type Option } from "effect";

import type { UserId } from "@quack/contracts/identity/user";
import type { Todo, TodoId } from "@quack/contracts/todos/todo";

/** Port. The domain owns the interface; infrastructure provides the Layer. */
export class TodoRepository extends Context.Service<
  TodoRepository,
  {
    readonly nextId: Effect.Effect<TodoId>;
    findAll(ownerId: UserId): Effect.Effect<ReadonlyArray<Todo>>;
    findById(ownerId: UserId, id: TodoId): Effect.Effect<Option.Option<Todo>>;
    save(todo: Todo): Effect.Effect<void>;
    /** Succeeds with `false` when this Owner has no todo with this id. */
    remove(ownerId: UserId, id: TodoId): Effect.Effect<boolean>;
  }
>()("@quack/server/todos/TodoRepository") {}
