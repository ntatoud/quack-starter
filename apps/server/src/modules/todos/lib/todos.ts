// PROTOTYPE (wayfinder #260): the Todos module's one service, its queries inside it.
// No repository: it had one real adapter. A service, not plain functions: its Layer takes the
// database once, so neither the handlers nor the Api carry `SqlClient` as a per-request need.
import { UserId } from "@quack/contracts/identity/user";
import { Todo, TodoId, type TodoTitle } from "@quack/contracts/todos/todo";
import { TodoNotFound } from "@quack/contracts/todos/todo-errors";
import { executor } from "@quack/effect-kysely/kysely";
import { Context, DateTime, Effect, Layer, Schema, SchemaTransformation } from "effect";
import { SqlSchema } from "effect/sql";

import { db } from "#/database/db.ts";

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

export class Todos extends Context.Service<
  Todos,
  {
    list(ownerId: UserId): Effect.Effect<ReadonlyArray<Todo>>;
    create(ownerId: UserId, title: TodoTitle): Effect.Effect<Todo>;
    complete(ownerId: UserId, id: TodoId): Effect.Effect<Todo, TodoNotFound>;
    remove(ownerId: UserId, id: TodoId): Effect.Effect<void, TodoNotFound>;
    /** Stores Todos made elsewhere, keeping any already stored: the seed's way in. */
    insert(todos: ReadonlyArray<Todo>): Effect.Effect<void>;
  }
>()("@quack/server/todos/Todos") {
  static readonly layer = Layer.effect(
    Todos,
    Effect.gen(function* () {
      const execute = yield* executor;

      const insert = SqlSchema.void({
        Request: TodoRow,
        execute: (row) =>
          execute(db.insertInto("todos").values(row).onConflict((c) => c.doNothing())),
      });

      // One statement: completing an already completed Todo changes nothing, and another Owner's is not found.
      const complete = SqlSchema.findOneOption({
        Request: OwnedTodo,
        Result: TodoRow,
        execute: ({ ownerId, id }) =>
          execute(
            db
              .updateTable("todos")
              .set({ completed: true })
              .where("ownerId", "=", ownerId)
              .where("id", "=", id)
              .returningAll(),
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

      return Todos.of({
        list: Effect.fn("Todos.list")((ownerId) =>
          SqlSchema.findAll({
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
          })(ownerId).pipe(Effect.orDie),
        ),
        create: Effect.fn("Todos.create")(function* (ownerId, title) {
          const todo = new Todo({
            id: TodoId.make(crypto.randomUUID()),
            ownerId,
            title,
            completed: false,
            createdAt: yield* DateTime.now,
          });
          yield* insert(todo).pipe(Effect.orDie);

          return todo;
        }),
        complete: Effect.fn("Todos.complete")(function* (ownerId, id) {
          if (!isStorableId(id)) return yield* new TodoNotFound({ id });

          const completed = yield* complete({ ownerId, id }).pipe(Effect.orDie);

          return yield* Effect.fromOption(completed).pipe(
            Effect.mapError(() => new TodoNotFound({ id })),
          );
        }),
        remove: Effect.fn("Todos.remove")(function* (ownerId, id) {
          const removed = isStorableId(id) ? yield* remove({ ownerId, id }).pipe(Effect.orDie) : [];

          if (removed.length === 0) return yield* new TodoNotFound({ id });
        }),
        insert: Effect.fn("Todos.insert")((todos) =>
          Effect.forEach(todos, (todo) => insert(todo), { discard: true }).pipe(Effect.orDie),
        ),
      });
    }),
  );
}
