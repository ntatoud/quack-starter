import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

import rule from "#/rules/no-sql-unsafe.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const adapter = "/repo/apps/server/src/modules/todos/infrastructure/todo-repository-postgres.ts";
const migration = "/repo/apps/server/src/database/migrations/0001_create_todos.ts";
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
  ],
  invalid: [
    { filename: adapter, code: "sql.unsafe(`SELECT * FROM ${table}`);", errors: [error] },
    { filename: adapter, code: "client.unsafe(text);", errors: [error] },
    { filename: adapter, code: 'sql["unsafe"](text);', errors: [error] },
    { filename: adapter, code: "const { unsafe } = sql;", errors: [error] },
    { filename: adapter, code: "const run = sql.unsafe;", errors: [error] },
    {
      filename: "/repo/apps/server/src/database/database.ts",
      code: "sql.unsafe(text);",
      errors: [error],
    },
  ],
});
