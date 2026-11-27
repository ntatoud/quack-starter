import { assert, describe, it } from "@effect/vitest";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import { DateTime, Effect, Layer } from "effect";

import { IdentityPostgres, UserRepository } from "#/modules/identity/index.ts";
import { TestDatabase } from "#/modules/testing/index.ts";
import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";
import { TodosPostgres, TodosSeed } from "#/modules/todos/index.ts";

const anOwner = () => UserId.make(crypto.randomUUID());

const storeOwner = Effect.fn("storeOwner")(function* (id: UserId) {
  const users = yield* UserRepository;

  yield* users.create(
    new User({
      id,
      email: Email.make(`${id}@example.com`),
      role: "user",
      status: "active",
      createdAt: yield* DateTime.now,
      lastSignInAt: null,
      onboardedAt: null,
      timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
      profile: null,
    }),
    "no password",
  );
});

// Each call is a database of its own: the Todos of an owner are those of this run alone.
const seededTodos = (owners: ReadonlyArray<UserId>, runs: number) =>
  Effect.gen(function* () {
    const repository = yield* TodoRepository;
    yield* Effect.forEach(owners, storeOwner, { discard: true });

    for (let run = 0; run < runs; run++) {
      yield* Layer.build(TodosSeed(owners)).pipe(Effect.scoped);
    }

    return yield* Effect.forEach(owners, repository.findAll);
  }).pipe(
    Effect.provide(
      Layer.mergeAll(TodosPostgres, IdentityPostgres).pipe(Layer.provideMerge(TestDatabase)),
    ),
  );

describe("TodosSeed", () => {
  it.effect("gives each owner a few Todos of their own, some completed, some not", () =>
    Effect.gen(function* () {
      const owners = [anOwner(), anOwner()];

      const todosByOwner = yield* seededTodos(owners, 1);

      todosByOwner.forEach((todos, index) => {
        assert.isAtLeast(todos.length, 3);
        assert.isTrue(todos.every(({ ownerId }) => ownerId === owners[index]));
        assert.isTrue(todos.some(({ completed }) => completed));
        assert.isTrue(todos.some(({ completed }) => !completed));
      });
    }),
  );

  it.effect("gives the same Todos, ids and dates included, at every run", () =>
    Effect.gen(function* () {
      const owners = [anOwner(), anOwner()];

      const once = yield* seededTodos(owners, 1);
      const twice = yield* seededTodos(owners, 2);

      assert.deepStrictEqual(twice, once);
    }),
  );

  it.effect("gives an owner the same Todos whoever else is seeded with them", () =>
    Effect.gen(function* () {
      const [owner, other] = [anOwner(), anOwner()];

      const [alone] = yield* seededTodos([owner], 1);
      const [, withOther] = yield* seededTodos([other, owner], 1);

      assert.deepStrictEqual(withOther, alone);
    }),
  );
});
