import { assert, describe, it } from "@effect/vitest";
import { UserId } from "@quack/contracts/identity/user";
import { Effect, Layer } from "effect";

import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";
import { TodosSeed } from "#/modules/todos/index.ts";
import { TodoRepositoryMemory } from "#/modules/todos/testing/todo-repository-memory.ts";

const anOwner = () => UserId.make(crypto.randomUUID());

const seededTodos = (owners: ReadonlyArray<UserId>, runs: number) =>
  Effect.gen(function* () {
    const repository = yield* TodoRepository;
    for (let run = 0; run < runs; run++) {
      yield* Layer.build(TodosSeed(owners)).pipe(Effect.scoped);
    }
    return yield* Effect.forEach(owners, repository.findAll);
  }).pipe(Effect.provide(TodoRepositoryMemory));

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
});
