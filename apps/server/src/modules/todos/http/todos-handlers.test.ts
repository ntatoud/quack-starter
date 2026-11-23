import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import { TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { TodoNotFound } from "@quack/contracts/todos/todo-errors";
import { DateTime, Effect, Layer } from "effect";
import { HttpClientRequest, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";

import { authenticationByUserId } from "#/modules/identity/testing/authentication-by-user-id.ts";
import { TodosModule } from "#/modules/todos/index.ts";
import { TodoRepositoryMemory } from "#/modules/todos/testing/todo-repository-memory.ts";

const ada = new User({
  id: UserId.make("ada"),
  email: Email.make("ada@example.com"),
  role: "user",
  status: "active",
  createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  lastSignInAt: null,
  onboardedAt: null,
  timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
  profile: null,
});

const grace = new User({
  id: UserId.make("grace"),
  email: Email.make("grace@example.com"),
  role: "user",
  status: "active",
  createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  lastSignInAt: null,
  onboardedAt: null,
  timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
  profile: null,
});

const users: ReadonlyArray<User> = [ada, grace];

const clientOf = (user: User) =>
  HttpApiTest.groups(Api, ["todos"]).pipe(
    Effect.provide(
      HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
        next(HttpClientRequest.setHeader(request, "cookie", `session=${user.id}`)),
      ),
    ),
  );

const TodosLayer = TodosModule.pipe(
  Layer.provide(TodoRepositoryMemory),
  Layer.provideMerge(authenticationByUserId(users)),
);

layer(Layer.mergeAll(TodosLayer, HttpServer.layerServices))("TodosApi", (it) => {
  it.effect("creates a todo that the Current User owns", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(ada);

      const created = yield* client.todos.create({
        payload: { title: TodoTitle.make("Ship it") },
      });

      assert.strictEqual(created.ownerId, ada.id);
    }),
  );

  it.effect("lists the todos of the Current User only", () =>
    Effect.gen(function* () {
      const asAda = yield* clientOf(ada);
      const asGrace = yield* clientOf(grace);

      const ofAda = yield* asAda.todos.create({
        payload: { title: TodoTitle.make("Write the engine") },
      });

      const ofGrace = yield* asGrace.todos.create({
        payload: { title: TodoTitle.make("Write the compiler") },
      });

      const seenByAda = (yield* asAda.todos.list()).map((todo) => todo.id);
      const seenByGrace = (yield* asGrace.todos.list()).map((todo) => todo.id);

      assert.include(seenByAda, ofAda.id);
      assert.notInclude(seenByAda, ofGrace.id);
      assert.include(seenByGrace, ofGrace.id);
      assert.notInclude(seenByGrace, ofAda.id);
    }),
  );

  it.effect("lets another User neither see, complete, nor remove a todo: it is not found", () =>
    Effect.gen(function* () {
      const asAda = yield* clientOf(ada);
      const asGrace = yield* clientOf(grace);

      const ofAda = yield* asAda.todos.create({
        payload: { title: TodoTitle.make("Keep it private") },
      });

      const seenByGrace = (yield* asGrace.todos.list()).map((todo) => todo.id);
      const params = { id: ofAda.id };
      const completeError = yield* asGrace.todos.complete({ params }).pipe(Effect.flip);

      const completeResponse = yield* asGrace.todos.complete({
        params,
        responseMode: "response-only",
      });

      const removeError = yield* asGrace.todos.remove({ params }).pipe(Effect.flip);

      const removeResponse = yield* asGrace.todos.remove({
        params,
        responseMode: "response-only",
      });

      assert.notInclude(seenByGrace, ofAda.id);
      assert.deepStrictEqual(completeError, new TodoNotFound({ id: ofAda.id }));
      assert.strictEqual(completeResponse.status, 404);
      assert.deepStrictEqual(removeError, new TodoNotFound({ id: ofAda.id }));
      assert.strictEqual(removeResponse.status, 404);
      assert.deepStrictEqual(
        (yield* asAda.todos.list()).filter((todo) => todo.id === ofAda.id),
        [ofAda],
      );
    }),
  );

  it.effect("creates, completes, and removes a todo", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(ada);

      const created = yield* client.todos.create({
        payload: { title: TodoTitle.make("Ship it") },
      });

      assert.isFalse(created.completed);

      const completed = yield* client.todos.complete({ params: { id: created.id } });
      assert.isTrue(completed.completed);

      yield* client.todos.remove({ params: { id: created.id } });
      const remaining = yield* client.todos.list();
      assert.isFalse(remaining.some((todo) => todo.id === created.id));
    }),
  );

  it.effect("fails with TodoNotFound for an unknown id", () =>
    Effect.gen(function* () {
      const client = yield* clientOf(ada);

      const error = yield* client.todos
        .complete({ params: { id: TodoId.make("missing") } })
        .pipe(Effect.flip);

      assert.strictEqual(error._tag, "TodoNotFound");
    }),
  );
});
