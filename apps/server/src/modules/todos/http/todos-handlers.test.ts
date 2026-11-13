import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";

import { TodosModule } from "#/modules/todos/index.ts";

const makeClient = HttpApiTest.groups(Api, ["todos"]);

// `HttpApiTest` builds the routes of the whole Api, so it asks for the middleware that `me` declares.
// No endpoint of the todos carries it, so this implementation is never called.
const AuthenticationUnused = Layer.succeed(
  Authentication,
  Authentication.of({ session: () => Effect.fail(new Unauthenticated()) }),
);

layer(Layer.mergeAll(TodosModule, AuthenticationUnused, HttpServer.layerServices))(
  "TodosApi",
  (it) => {
    it.effect("creates, completes, and removes a todo", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;

        const created = yield* client.todos.create({
          payload: { title: TodoTitle.make("Ship it") },
        });
        assert.isFalse(created.completed);

        const completed = yield* client.todos.complete({ params: { id: created.id } });
        assert.isTrue(completed.completed);

        yield* client.todos.remove({ params: { id: created.id } });
        assert.deepStrictEqual(yield* client.todos.list(), []);
      }),
    );

    it.effect("fails with TodoNotFound for an unknown id", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;

        const error = yield* client.todos
          .complete({ params: { id: TodoId.make("missing") } })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "TodoNotFound");
      }),
    );
  },
);
