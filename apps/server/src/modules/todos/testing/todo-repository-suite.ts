import { assert, describe, it } from "@effect/vitest";
import { UserId } from "@quack/contracts/identity/user";
import { Todo, TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { DateTime, Effect, type Layer, Option } from "effect";

import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";

const ada = UserId.make("ada");
const grace = UserId.make("grace");

const aTodo = (fields: Partial<Todo> & Pick<Todo, "id">) =>
  new Todo({
    ownerId: ada,
    title: TodoTitle.make("Ship it"),
    completed: false,
    createdAt: at("2026-01-01T00:00:00Z"),
    ...fields,
  });

const at = (iso: string) => DateTime.makeUnsafe(iso);

export const todoRepositorySuite = (layer: Layer.Layer<TodoRepository>) => {
  const test = (name: string, body: () => Effect.Effect<void, never, TodoRepository>) =>
    it.effect(name, () => body().pipe(Effect.provide(layer)));

  describe("TodoRepository", () => {
    test("finds a saved Todo by its Owner and id", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const todo = aTodo({ id: yield* repository.nextId });

        yield* repository.save(todo);

        assert.deepStrictEqual(yield* repository.findById(ada, todo.id), Option.some(todo));
      }));

    test("does not find a Todo of another Owner", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const todo = aTodo({ id: yield* repository.nextId });

        yield* repository.save(todo);

        assert.isTrue(Option.isNone(yield* repository.findById(grace, todo.id)));
      }));

    test("lists the Todos of an Owner by creation, then by id", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const last = aTodo({ id: TodoId.make("a"), createdAt: at("2026-03-01T00:00:00Z") });
        const first = aTodo({ id: TodoId.make("b"), createdAt: at("2026-01-01T00:00:00Z") });
        const second = aTodo({ id: TodoId.make("c"), createdAt: at("2026-01-01T00:00:00Z") });
        const others = aTodo({ id: TodoId.make("d"), ownerId: grace });

        yield* Effect.forEach([last, second, others, first], repository.save);

        assert.deepStrictEqual(
          (yield* repository.findAll(ada)).map(({ id }) => id),
          [first.id, second.id, last.id],
        );
      }));

    test("gives a new id each time", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;

        assert.notStrictEqual(yield* repository.nextId, yield* repository.nextId);
      }));

    test("replaces the Todo of the same id on save", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const todo = aTodo({ id: yield* repository.nextId });
        const completed = aTodo({ id: todo.id, completed: true });

        yield* repository.save(todo);
        yield* repository.save(completed);

        assert.deepStrictEqual(yield* repository.findAll(ada), [completed]);
      }));

    test("removes a Todo of its Owner and says so", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const todo = aTodo({ id: yield* repository.nextId });
        yield* repository.save(todo);

        assert.isTrue(yield* repository.remove(ada, todo.id));
        assert.isTrue(Option.isNone(yield* repository.findById(ada, todo.id)));
      }));

    test("removes nothing for another Owner and says so", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const todo = aTodo({ id: yield* repository.nextId });
        yield* repository.save(todo);

        assert.isFalse(yield* repository.remove(grace, todo.id));
        assert.deepStrictEqual(yield* repository.findById(ada, todo.id), Option.some(todo));
      }));

    test("removes nothing for an unknown id and says so", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;

        assert.isFalse(yield* repository.remove(ada, yield* repository.nextId));
      }));
  });
};
