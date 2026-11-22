import { Api } from "@quack/contracts/api";
import { CurrentUser } from "@quack/contracts/identity/authentication";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { Todos } from "#/modules/todos/application/todos.ts";

export const TodosHandlers = HttpApiBuilder.group(
  Api,
  "todos",
  Effect.fn(function* (handlers) {
    const todos = yield* Todos;

    return handlers.handleAll({
      list: Effect.fn(function* () {
        const owner = yield* CurrentUser;

        return yield* todos.list(owner.id);
      }),
      create: Effect.fn(function* ({ payload }) {
        const owner = yield* CurrentUser;

        return yield* todos.create(owner.id, payload.title);
      }),
      complete: Effect.fn(function* ({ params }) {
        const owner = yield* CurrentUser;

        return yield* todos.complete(owner.id, params.id);
      }),
      remove: Effect.fn(function* ({ params }) {
        const owner = yield* CurrentUser;

        return yield* todos.remove(owner.id, params.id);
      }),
    });
  }),
);
