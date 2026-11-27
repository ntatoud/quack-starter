import { assert, it } from "@effect/vitest";
import { TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { TodoNotFound } from "@quack/contracts/todos/todo-errors";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";

import { IdentityModule, IdentityPostgres } from "#/modules/identity/index.ts";
import { MailerMemory } from "#/modules/mail/testing/mailer-memory.ts";
import { aUser, signedIn, TestDatabase } from "#/modules/testing/index.ts";
import { seedTodos, TodosModule } from "#/modules/todos/index.ts";
import { TransactionPostgres } from "#/modules/transaction/index.ts";

const TodosApi = TodosModule.pipe(
  Layer.provideMerge(IdentityModule),
  Layer.provideMerge([IdentityPostgres, TransactionPostgres]),
  Layer.provide(MailerMemory),
  Layer.provideMerge(HttpServer.layerServices),
  Layer.provide(TestDatabase),
  Layer.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ PUBLIC_URL: "https://quack.test" })),
  ),
);

const signedInUser = Effect.flatMap(aUser(), (user) =>
  Effect.map(signedIn(user, ["todos"]), (client) => ({ user, client })),
);

it.effect("creates a todo that the Current User owns", () =>
  Effect.gen(function* () {
    const { user, client } = yield* signedInUser;

    const created = yield* client.todos.create({ payload: { title: TodoTitle.make("Ship it") } });

    assert.strictEqual(created.ownerId, user.id);
  }).pipe(Effect.provide(TodosApi)),
);

it.effect("lists the todos of the Current User only", () =>
  Effect.gen(function* () {
    const { client: asAda } = yield* signedInUser;
    const { client: asGrace } = yield* signedInUser;

    const ofAda = yield* asAda.todos.create({
      payload: { title: TodoTitle.make("Write the engine") },
    });

    const ofGrace = yield* asGrace.todos.create({
      payload: { title: TodoTitle.make("Write the compiler") },
    });

    assert.deepStrictEqual(yield* asAda.todos.list(), [ofAda]);
    assert.deepStrictEqual(yield* asGrace.todos.list(), [ofGrace]);
  }).pipe(Effect.provide(TodosApi)),
);

it.effect("lets another User neither see, complete, nor remove a todo: it is not found", () =>
  Effect.gen(function* () {
    const { client: asAda } = yield* signedInUser;
    const { client: asGrace } = yield* signedInUser;

    const ofAda = yield* asAda.todos.create({
      payload: { title: TodoTitle.make("Keep it private") },
    });

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

    assert.deepStrictEqual(yield* asGrace.todos.list(), []);
    assert.deepStrictEqual(completeError, new TodoNotFound({ id: ofAda.id }));
    assert.strictEqual(completeResponse.status, 404);
    assert.deepStrictEqual(removeError, new TodoNotFound({ id: ofAda.id }));
    assert.strictEqual(removeResponse.status, 404);
    assert.deepStrictEqual(yield* asAda.todos.list(), [ofAda]);
  }).pipe(Effect.provide(TodosApi)),
);

it.effect("creates, completes (twice without harm), and removes a todo", () =>
  Effect.gen(function* () {
    const { client } = yield* signedInUser;

    const created = yield* client.todos.create({ payload: { title: TodoTitle.make("Ship it") } });

    assert.isFalse(created.completed);

    const completed = yield* client.todos.complete({ params: { id: created.id } });
    assert.isTrue(completed.completed);
    assert.deepStrictEqual(yield* client.todos.complete({ params: { id: created.id } }), completed);

    yield* client.todos.remove({ params: { id: created.id } });
    assert.deepStrictEqual(yield* client.todos.list(), []);
  }).pipe(Effect.provide(TodosApi)),
);

it.effect("fails with TodoNotFound for an unknown id", () =>
  Effect.gen(function* () {
    const { client } = yield* signedInUser;

    const error = yield* client.todos
      .complete({ params: { id: TodoId.make("missing") } })
      .pipe(Effect.flip);

    assert.strictEqual(error._tag, "TodoNotFound");
  }).pipe(Effect.provide(TodosApi)),
);

// The seed spaces its Todos on the real clock.
it.live("seeds a few todos of the signed-in User, some completed, some not", () =>
  Effect.gen(function* () {
    const { user, client } = yield* signedInUser;

    yield* seedTodos(client.todos);

    const seeded = yield* client.todos.list();

    assert.isAtLeast(seeded.length, 3);
    assert.isTrue(seeded.every(({ ownerId }) => ownerId === user.id));
    assert.isTrue(seeded.some(({ completed }) => completed));
    assert.isTrue(seeded.some(({ completed }) => !completed));
  }).pipe(Effect.provide(TodosApi)),
);
