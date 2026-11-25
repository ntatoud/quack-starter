import { UserId } from "@quack/contracts/identity/user";
import { Todo, TodoId } from "@quack/contracts/todos/todo";
import { Effect, Layer, Schema, SchemaTransformation } from "effect";
import { executor } from "@quack/effect-kysely/kysely";
import { SqlSchema } from "effect/sql";

import { db } from "#/database/db.ts";

import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";

const TodoRow = Schema.Struct({
  id: TodoId,
  ownerId: UserId,
  title: Todo.fields.title,
  completed: Schema.Boolean,
  createdAt: Schema.DateTimeUtcFromDate,
}).pipe(
  Schema.decodeTo(
    Schema.toType(Todo),
    SchemaTransformation.transform({ decode: (row) => new Todo(row), encode: (todo) => todo }),
  ),
);

const OwnedTodo = Schema.Struct({ ownerId: UserId, id: TodoId });

// The column is a uuid: Postgres refuses any other id, which no Todo can have.
const isStorableId = Schema.is(Schema.String.check(Schema.isUUID()));

export const TodoRepositoryPostgres = Layer.effect(
  TodoRepository,
  Effect.gen(function* () {
    const execute = yield* executor;

    const findAll = SqlSchema.findAll({
      Request: UserId,
      Result: TodoRow,
      execute: (ownerId) =>
        execute(
          db
            .selectFrom("todos")
            .selectAll()
            .where("ownerId", "=", ownerId)
            .orderBy("createdAt")
            .orderBy("id"),
        ),
    });

    const findById = SqlSchema.findOneOption({
      Request: OwnedTodo,
      Result: TodoRow,
      execute: ({ ownerId, id }) =>
        execute(
          db.selectFrom("todos").selectAll().where("ownerId", "=", ownerId).where("id", "=", id),
        ),
    });

    const save = SqlSchema.void({
      Request: TodoRow,
      execute: (todo) =>
        execute(
          db
            .insertInto("todos")
            .values(todo)
            .onConflict((conflict) =>
              conflict
                .column("id")
                .doUpdateSet((eb) => ({
                  title: eb.ref("excluded.title"),
                  completed: eb.ref("excluded.completed"),
                }))
                .whereRef("todos.ownerId", "=", "excluded.ownerId"),
            ),
        ),
    });

    const remove = SqlSchema.findAll({
      Request: OwnedTodo,
      Result: Schema.Struct({ id: TodoId }),
      execute: ({ ownerId, id }) =>
        execute(
          db
            .deleteFrom("todos")
            .where("ownerId", "=", ownerId)
            .where("id", "=", id)
            .returning("id"),
        ),
    });

    return TodoRepository.of({
      nextId: Effect.sync(() => TodoId.make(crypto.randomUUID())),
      findAll: Effect.fn("TodoRepository.findAll")((ownerId) =>
        findAll(ownerId).pipe(Effect.orDie),
      ),
      findById: Effect.fn("TodoRepository.findById")((ownerId, id) =>
        isStorableId(id) ? findById({ ownerId, id }).pipe(Effect.orDie) : Effect.succeedNone,
      ),
      save: Effect.fn("TodoRepository.save")((todo) => save(todo).pipe(Effect.orDie)),
      remove: Effect.fn("TodoRepository.remove")((ownerId, id) =>
        isStorableId(id)
          ? remove({ ownerId, id }).pipe(
              Effect.map((removed) => removed.length > 0),
              Effect.orDie,
            )
          : Effect.succeed(false),
      ),
    });
  }),
);
