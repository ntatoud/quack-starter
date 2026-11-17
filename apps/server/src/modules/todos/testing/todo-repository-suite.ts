import { assert, describe, it } from "@effect/vitest";
import { UserId } from "@quack/contracts/identity/user";
import { Todo, TodoId, TodoTitle } from "@quack/contracts/todos/todo";
import { DateTime, Effect, type Layer, Option } from "effect";

import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";

const at = (iso: string) => DateTime.makeUnsafe(iso);

// An adapter that persists keeps the Todos of the tests before, so each test has its own Owners.
const anOwner = Effect.sync(() => UserId.make(crypto.randomUUID()));

const aTodo = (fields: Partial<Todo> & Pick<Todo, "id" | "ownerId">) =>
  new Todo({
    title: TodoTitle.make("Ship it"),
    completed: false,
    createdAt: at("2026-01-01T00:00:00Z"),
    ...fields,
  });

const aSavedTodo = (ownerId: UserId) =>
  Effect.gen(function* () {
    const repository = yield* TodoRepository;
    const todo = aTodo({ id: yield* repository.nextId, ownerId });
    yield* repository.save(todo);
    return todo;
  });

export const todoRepositorySuite = (layer: Layer.Layer<TodoRepository>) => {
  const test = (name: string, body: () => Effect.Effect<void, never, TodoRepository>) =>
    it.effect(name, () => body().pipe(Effect.provide(layer)));

  describe("TodoRepository", () => {
    test("finds a saved Todo by its Owner and id", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const owner = yield* anOwner;
        const todo = yield* aSavedTodo(owner);

        assert.deepStrictEqual(yield* repository.findById(owner, todo.id), Option.some(todo));
      }));

    test("does not find a Todo of another Owner", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const todo = yield* aSavedTodo(yield* anOwner);

        assert.isTrue(Option.isNone(yield* repository.findById(yield* anOwner, todo.id)));
      }));

    test("lists the Todos of an Owner by creation, then by id", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const owner = yield* anOwner;
        const idOf = (suffix: string) => TodoId.make(`${owner}-${suffix}`);
        const last = aTodo({
          id: idOf("a"),
          ownerId: owner,
          createdAt: at("2026-03-01T00:00:00Z"),
        });
        const first = aTodo({
          id: idOf("b"),
          ownerId: owner,
          createdAt: at("2026-01-01T00:00:00Z"),
        });
        const second = aTodo({
          id: idOf("c"),
          ownerId: owner,
          createdAt: at("2026-01-01T00:00:00Z"),
        });
        const otherOwners = aTodo({ id: idOf("d"), ownerId: yield* anOwner });

        yield* Effect.forEach([last, second, otherOwners, first], repository.save);

        assert.deepStrictEqual(
          (yield* repository.findAll(owner)).map(({ id }) => id),
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
        const owner = yield* anOwner;
        const todo = yield* aSavedTodo(owner);
        const completed = aTodo({ id: todo.id, ownerId: owner, completed: true });

        yield* repository.save(completed);

        assert.deepStrictEqual(yield* repository.findAll(owner), [completed]);
      }));

    test("removes a Todo of its Owner and says so", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const owner = yield* anOwner;
        const todo = yield* aSavedTodo(owner);

        assert.isTrue(yield* repository.remove(owner, todo.id));
        assert.isTrue(Option.isNone(yield* repository.findById(owner, todo.id)));
      }));

    test("removes nothing for another Owner and says so", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;
        const owner = yield* anOwner;
        const todo = yield* aSavedTodo(owner);

        assert.isFalse(yield* repository.remove(yield* anOwner, todo.id));
        assert.deepStrictEqual(yield* repository.findById(owner, todo.id), Option.some(todo));
      }));

    test("removes nothing for an unknown id and says so", () =>
      Effect.gen(function* () {
        const repository = yield* TodoRepository;

        assert.isFalse(yield* repository.remove(yield* anOwner, yield* repository.nextId));
      }));
  });
};
