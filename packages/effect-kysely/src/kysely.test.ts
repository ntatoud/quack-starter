import { PgliteClient } from "@effect/sql-pglite";
import { assert, layer } from "@effect/vitest";
import { Duration, Effect, Layer, String, Tracer } from "effect";
import { SqlClient } from "effect/sql";
import { CamelCasePlugin } from "kysely";
import { expect, expectTypeOf, test } from "vite-plus/test";

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

const insert = (bodyText: string, id = crypto.randomUUID()) =>
  Effect.gen(function* () {
    const execute = yield* executor;
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
      const id = crypto.randomUUID();

      yield* sql
        .withTransaction(
          insert("dropped with the transaction", id).pipe(Effect.andThen(Effect.fail("halfway"))),
        )
        .pipe(Effect.ignore);

      assert.deepStrictEqual(yield* find(id), []);
    }),
  );

  it.effect("is traced as a sql template, with the text Kysely compiled", () =>
    Effect.gen(function* () {
      const tracer = yield* Effect.tracer;
      const queryTexts: Array<unknown> = [];

      const recording = Tracer.make({
        span: (options) => {
          const span = tracer.span(options);
          const attribute = span.attribute.bind(span);

          span.attribute = (key, value) => {
            if (key === "db.query.text") queryTexts.push(value);
            attribute(key, value);
          };

          return span;
        },
      });

      yield* find(crypto.randomUUID()).pipe(Effect.withTracer(recording));

      assert.deepStrictEqual(queryTexts, ['select * from "notes" where "id" = $1']);
    }),
  );

  it.effect("types a write without returning as one that returns no rows", () =>
    Effect.gen(function* () {
      const execute = yield* executor;
      const rows = yield* execute(db.deleteFrom("notes").where("id", "=", crypto.randomUUID()));

      expectTypeOf(rows).toEqualTypeOf<ReadonlyArray<never>>();
      assert.deepStrictEqual(rows, []);
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

// Every way Kysely runs a query asks its driver for a connection, which the compile-only driver refuses.
test("refuses Kysely's own execute, stream, and transaction, which would answer no rows", async () => {
  const query = db.selectFrom("notes").selectAll();
  const refused = /executor of @quack\/effect-kysely/;

  await expect(query.execute()).rejects.toThrow(refused);
  await expect(query.stream().next()).rejects.toThrow(refused);
  await expect(db.transaction().execute(async () => {})).rejects.toThrow(refused);
});
