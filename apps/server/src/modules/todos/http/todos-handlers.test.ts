import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication, CurrentUser } from "@quack/contracts/identity/authentication";
import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import { TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { TodoNotFound } from "@quack/contracts/todos/todo-errors";
import { Effect, Layer, Redacted } from "effect";
import { HttpClientRequest, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";

import { TodosModule } from "#/modules/todos/index.ts";

const ada = new User({
  id: UserId.make("ada"),
  email: Email.make("ada@example.com"),
  role: "user",
});
const grace = new User({
  id: UserId.make("grace"),
  email: Email.make("grace@example.com"),
  role: "user",
});
const users: ReadonlyArray<User> = [ada, grace];

// The session cookie is the id of the Current User: these tests need a Current User, not a Session.
const AuthenticationByUserId = Layer.succeed(
  Authentication,
  Authentication.of({
    session: (httpEffect, { credential }) => {
      const user = users.find(({ id }) => id === Redacted.value(credential));
      return user === undefined
        ? Effect.fail(new Unauthenticated())
        : Effect.provideService(httpEffect, CurrentUser, user);
    },
  }),
);

const clientOf = (user: User) =>
  HttpApiTest.groups(Api, ["todos"]).pipe(
    Effect.provide(
      HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
        next(HttpClientRequest.setHeader(request, "cookie", `session=${user.id}`)),
      ),
    ),
  );

const TodosLayer = TodosModule.pipe(Layer.provideMerge(AuthenticationByUserId));

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
