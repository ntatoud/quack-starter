// PROTOTYPE (wayfinder #260): the Todos module tested only through the Api, on PGlite.
// Flat: no describe, no shared layer(...). Each test provides the file's Layer and owns its Users.
import { assert, it } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Email, User } from "@quack/contracts/identity/user";
import { TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { TodoNotFound } from "@quack/contracts/todos/todo-errors";
import { DateTime, Effect, Layer } from "effect";
import { HttpClientRequest, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";

// Reaches into identity's internals: the open question of what identity's index.ts offers tests.
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { UserRepositoryPostgres } from "#/modules/identity/infrastructure/user-repository-postgres.ts";
import { authenticationByUserId } from "#/modules/identity/testing/authentication-by-user-id.ts";
import { TodosModule, TodosSeed } from "#/modules/todos/index.ts";
import { TestDatabase } from "#/testing/test-database.ts";

const users: Array<User> = [];

// Built once for the file (Layers are memoized by reference), so PGlite migrates once.
const TodosApi = Layer.mergeAll(
  TodosModule.pipe(Layer.provideMerge(authenticationByUserId(users))),
  UserRepositoryPostgres,
  HttpServer.layerServices,
).pipe(Layer.provideMerge(TestDatabase));

// A User of the test's own, stored so that their Todos have an Owner.
const aUser = Effect.gen(function* () {
  const repository = yield* UserRepository;
  const id = yield* repository.nextId;
  const user = new User({
    id,
    email: Email.make(`${id}@example.com`),
    role: "user",
    status: "active",
    createdAt: yield* DateTime.now,
    lastSignInAt: null,
    onboardedAt: null,
    timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
    profile: null,
  });
  yield* repository.create(user, "not a hash").pipe(Effect.orDie);
  users.push(user);

  return user;
});

const clientOf = (user: User) =>
  HttpApiTest.groups(Api, ["todos"]).pipe(
    Effect.provide(
      HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
        next(HttpClientRequest.setHeader(request, "cookie", `session=${user.id}`)),
      ),
    ),
  );

it.effect("creates a todo that the Current User owns", () =>
  Effect.gen(function* () {
    const ada = yield* aUser;
    const client = yield* clientOf(ada);

    const created = yield* client.todos.create({ payload: { title: TodoTitle.make("Ship it") } });

    assert.strictEqual(created.ownerId, ada.id);
    assert.deepStrictEqual(yield* client.todos.list(), [created]);
  }).pipe(Effect.provide(TodosApi)),
);

it.effect("lets another User neither see, complete, nor remove a todo: it is not found", () =>
  Effect.gen(function* () {
    const asAda = yield* clientOf(yield* aUser);
    const asGrace = yield* clientOf(yield* aUser);

    const ofAda = yield* asAda.todos.create({ payload: { title: TodoTitle.make("Keep it") } });
    const params = { id: ofAda.id };

    assert.deepStrictEqual(yield* asGrace.todos.list(), []);
    assert.deepStrictEqual(
      yield* asGrace.todos.complete({ params }).pipe(Effect.flip),
      new TodoNotFound({ id: ofAda.id }),
    );
    assert.strictEqual(
      (yield* asGrace.todos.remove({ params, responseMode: "response-only" })).status,
      404,
    );
    assert.deepStrictEqual(yield* asAda.todos.list(), [ofAda]);
  }).pipe(Effect.provide(TodosApi)),
);

it.effect("completes a todo, twice without harm, then removes it", () =>
  Effect.gen(function* () {
    const client = yield* clientOf(yield* aUser);
    const created = yield* client.todos.create({ payload: { title: TodoTitle.make("Ship it") } });

    yield* client.todos.complete({ params: { id: created.id } });
    const again = yield* client.todos.complete({ params: { id: created.id } });
    assert.isTrue(again.completed);

    yield* client.todos.remove({ params: { id: created.id } });
    assert.deepStrictEqual(yield* client.todos.list(), []);
  }).pipe(Effect.provide(TodosApi)),
);

it.effect("answers TodoNotFound for an id that is not a uuid", () =>
  Effect.gen(function* () {
    const client = yield* clientOf(yield* aUser);

    const error = yield* client.todos
      .complete({ params: { id: TodoId.make("missing") } })
      .pipe(Effect.flip);

    assert.strictEqual(error._tag, "TodoNotFound");
  }).pipe(Effect.provide(TodosApi)),
);

// The seed is tested as a caller sees it: seeded twice, an Owner lists the same Todos.
it.effect("seeds each Owner the same few Todos at every run, some completed", () =>
  Effect.gen(function* () {
    const ada = yield* aUser;
    const client = yield* clientOf(ada);

    yield* Layer.build(TodosSeed([ada.id])).pipe(Effect.scoped);
    const once = yield* client.todos.list();
    yield* Layer.build(TodosSeed([ada.id])).pipe(Effect.scoped);

    assert.deepStrictEqual(yield* client.todos.list(), once);
    assert.isTrue(once.some(({ completed }) => completed));
    assert.isTrue(once.some(({ completed }) => !completed));
  }).pipe(Effect.provide(TodosApi)),
);
