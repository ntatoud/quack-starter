import { UserId } from "@quack/contracts/identity/user";
import { Todo, TodoId } from "@quack/contracts/todos/todo";
import { Effect, Layer, Schema, SchemaTransformation } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

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

export const TodoRepositoryPostgres = Layer.effect(
  TodoRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const findAll = SqlSchema.findAll({
      Request: UserId,
      Result: TodoRow,
      execute: (ownerId) =>
        sql`SELECT * FROM todos WHERE owner_id = ${ownerId} ORDER BY created_at, id`,
    });

    const findById = SqlSchema.findOneOption({
      Request: OwnedTodo,
      Result: TodoRow,
      execute: ({ ownerId, id }) =>
        sql`SELECT * FROM todos WHERE owner_id = ${ownerId} AND id = ${id}`,
    });

    const save = SqlSchema.void({
      Request: TodoRow,
      execute: (todo) =>
        sql`INSERT INTO todos ${sql.insert(todo)}
            ON CONFLICT (id) DO UPDATE SET
              title = excluded.title,
              completed = excluded.completed,
              created_at = excluded.created_at
            WHERE todos.owner_id = excluded.owner_id`,
    });

    const remove = SqlSchema.findAll({
      Request: OwnedTodo,
      Result: Schema.Struct({ id: TodoId }),
      execute: ({ ownerId, id }) =>
        sql`DELETE FROM todos WHERE owner_id = ${ownerId} AND id = ${id} RETURNING id`,
    });

    return TodoRepository.of({
      nextId: Effect.sync(() => TodoId.make(crypto.randomUUID())),
      findAll: Effect.fn("TodoRepository.findAll")((ownerId) =>
        findAll(ownerId).pipe(Effect.orDie),
      ),
      findById: Effect.fn("TodoRepository.findById")((ownerId, id) =>
        findById({ ownerId, id }).pipe(Effect.orDie),
      ),
      save: Effect.fn("TodoRepository.save")((todo) => save(todo).pipe(Effect.orDie)),
      remove: Effect.fn("TodoRepository.remove")((ownerId, id) =>
        remove({ ownerId, id }).pipe(
          Effect.map((removed) => removed.length > 0),
          Effect.orDie,
        ),
      ),
    });
  }),
);
