import { Api } from "@quack/contracts/Api";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Todos } from "#/modules/todos/application/Todos.ts";

export const TodosHandlers = HttpApiBuilder.group(
  Api,
  "todos",
  Effect.fn(function* (handlers) {
    const todos = yield* Todos;

    return handlers.handleAll({
      list: () => todos.list,
      create: ({ payload }) => todos.create(payload.title),
      complete: ({ params }) => todos.complete(params.id),
      remove: ({ params }) => todos.remove(params.id),
    });
  }),
);
