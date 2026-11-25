import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

import rule from "#/rules/no-sql-unsafe.ts";

RuleTester.describe = describe;

RuleTester.it = it;

const adapter = "/repo/apps/server/src/modules/todos/infrastructure/todo-repository-postgres.ts";
const migration = "/repo/apps/server/src/database/migrations/0001_create_todos.ts";

const kyselyRunner = "/repo/packages/effect-kysely/src/kysely.ts";

const raw = {
  message:
    "sql.raw and sql.lit write their value into the SQL text. Interpolate it in Kysely's sql`...`, which binds it as a parameter, or use sql.ref for a column.",
};

const error = {
  message:
    "sql.unsafe sends its text unescaped. Write a sql`...` template, whose values are bound parameters; only a migration, in database/migrations/, may use sql.unsafe.",
};

new RuleTester().run("no-sql-unsafe", rule, {
  valid: [
    { filename: adapter, code: "sql`SELECT * FROM todos WHERE id = ${id}`;" },
    { filename: adapter, code: "sql.in(ids);" },
    { filename: adapter, code: "const unsafe = 1; unsafe;" },
    { filename: migration, code: "sql.unsafe(`CREATE TABLE todos ()`);" },
    { filename: kyselyRunner, code: "client.unsafe(text, parameters);" },
    { filename: adapter, code: "sql.ref(column);" },
    { filename: adapter, code: "String.raw`a`;" },
    { filename: adapter, code: "const { raw } = String;" },
    { filename: adapter, code: 'import { sql as k } from "effect/sql"; k.raw(text);' },
  ],
  invalid: [
    { filename: adapter, code: "sql.unsafe(`SELECT * FROM ${table}`);", errors: [error] },
    { filename: adapter, code: "client.unsafe(text);", errors: [error] },
    { filename: adapter, code: 'sql["unsafe"](text);', errors: [error] },
    { filename: adapter, code: "const { unsafe } = sql;", errors: [error] },
    { filename: adapter, code: "const run = sql.unsafe;", errors: [error] },
    { filename: adapter, code: "const run = ({ unsafe }) => unsafe;", errors: [error] },
    { filename: adapter, code: "sql.raw(direction);", errors: [raw] },
    { filename: adapter, code: "sql.lit(value);", errors: [raw] },
    { filename: adapter, code: 'sql["raw"](direction);', errors: [raw] },
    { filename: adapter, code: "const { raw } = sql;", errors: [raw] },
    { filename: adapter, code: 'import { sql as k } from "kysely"; k.lit(value);', errors: [raw] },
    { filename: migration, code: "sql.raw(`text[]`);", errors: [raw] },
    { filename: kyselyRunner, code: "sql.lit(value);", errors: [raw] },
    {
      filename: "/repo/packages/effect-kysely/src/kysely.test.ts",
      code: "client.unsafe(text);",
      errors: [error],
    },
    {
      filename: "/repo/apps/server/src/database/database.ts",
      code: "sql.unsafe(text);",
      errors: [error],
    },
  ],
});
