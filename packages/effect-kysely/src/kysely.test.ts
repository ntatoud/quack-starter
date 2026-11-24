import { PgliteClient } from "@effect/sql-pglite";
import { assert, layer } from "@effect/vitest";
import { Duration, Effect, Layer, String } from "effect";
import { SqlClient } from "effect/sql";
import { CamelCasePlugin } from "kysely";
import { expect, test } from "vite-plus/test";

import { executor, postgres } from "#/kysely.ts";

interface Database {
  readonly notes: { readonly id: string; readonly bodyText: string };
}

const db = postgres<Database>({ plugins: [new CamelCasePlugin()] });

// The client the server configures: snake_case columns, camelCase rows.
const Postgres = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    yield* sql`CREATE TABLE notes (id text CONSTRAINT notes_pkey PRIMARY KEY, body_text text NOT NULL)`;
  }),
).pipe(
  Layer.provideMerge(
    PgliteClient.layer({
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    }),
  ),
  Layer.orDie,
);

const insert = (bodyText: string) =>
  Effect.gen(function* () {
    const execute = yield* executor;
    const id = crypto.randomUUID();
    yield* execute(db.insertInto("notes").values({ id, bodyText }));

    return id;
  });

const find = (id: string) =>
  Effect.flatMap(executor, (execute) =>
    execute(db.selectFrom("notes").selectAll().where("id", "=", id)),
  );

// PGlite starts Postgres compiled to WebAssembly: seconds alone, more beside the test files of every package.
layer(Postgres, { timeout: Duration.seconds(30) })("execute", (it) => {
  it.effect("runs the query on the SqlClient, with camelCase names on both sides", () =>
    Effect.gen(function* () {
      const id = yield* insert("milk");

      assert.deepStrictEqual(yield* find(id), [{ id, bodyText: "milk" }]);
    }),
  );

  it.effect("binds a value as a parameter, never as SQL", () =>
    Effect.gen(function* () {
      const bodyText = "'); DROP TABLE notes; --";
      const id = yield* insert(bodyText);

      assert.deepStrictEqual(yield* find(id), [{ id, bodyText }]);
    }),
  );

  it.effect("joins the transaction of its fiber", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      let id = "";

      yield* sql
        .withTransaction(
          insert("dropped with the transaction").pipe(
            Effect.tap((inserted) => Effect.sync(() => (id = inserted))),
            Effect.andThen(Effect.fail("halfway")),
          ),
        )
        .pipe(Effect.ignore);

      assert.deepStrictEqual(yield* find(id), []);
    }),
  );

  it.effect("fails with the SqlError of the client, naming the constraint", () =>
    Effect.gen(function* () {
      const id = yield* insert("first");

      const execute = yield* executor;

      const error = yield* execute(db.insertInto("notes").values({ id, bodyText: "second" })).pipe(
        Effect.flip,
      );

      assert.isTrue(
        error.reason._tag === "UniqueViolation" && error.reason.constraint === "notes_pkey",
      );
    }),
  );
});

test("refuses Kysely's own execute, which would answer no rows", async () => {
  const query = db.selectFrom("notes").selectAll();

  await expect(query.execute()).rejects.toThrow(/executor of @quack\/effect-kysely/);
});
