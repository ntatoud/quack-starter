import { Api } from "@quack/contracts/api";
import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Todos } from "#/modules/todos/lib/todos.ts";

export const TodosHandlers = HttpApiBuilder.group(
  Api,
  "todos",
  Effect.fn(function* (handlers) {
    const todos = yield* Todos;
    const owner = Effect.map(CurrentUser, ({ id }) => id);

    return handlers.handleAll({
      list: () => Effect.flatMap(owner, todos.list),
      create: ({ payload }) => Effect.flatMap(owner, (id) => todos.create(id, payload.title)),
      complete: ({ params }) => Effect.flatMap(owner, (id) => todos.complete(id, params.id)),
      remove: ({ params }) => Effect.flatMap(owner, (id) => todos.remove(id, params.id)),
    });
  }),
);
