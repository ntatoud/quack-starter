import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "node:path";

import { RuleTester } from "vite-plus/lint/plugins-dev";
import { afterAll, describe, it } from "vite-plus/test";

import rule from "#/rules/module-boundaries.ts";

RuleTester.describe = describe;

RuleTester.it = it;

const src = "/repo/apps/server/src";
const domain = `${src}/modules/todos/domain/Todo.ts`;
const application = `${src}/modules/todos/application/Todos.ts`;
const infrastructure = `${src}/modules/todos/infrastructure/TodoRepositoryMemory.ts`;
const http = `${src}/modules/todos/http/TodosHandlers.ts`;
const index = `${src}/modules/todos/index.ts`;
const testing = `${src}/modules/todos/testing/todo-repository-suite.ts`;
const domainTest = `${src}/modules/todos/domain/todo.test.ts`;
const infrastructureTest = `${src}/modules/todos/infrastructure/todo-repository-memory.test.ts`;
const httpTest = `${src}/modules/todos/http/todos-handlers.test.tsx`;
const routesTest = `${src}/server.test.ts`;

// The rule reads the disk to know whether a module has a lib/: `notes` has one, in the server and in the web app, and
// so has the server's `todos`.
const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "module-boundaries-"));
const deepSrc = `${root}/apps/server/src`;
const webSrc = `${root}/apps/web/src`;

for (const lib of ["modules/notes/lib", "modules/todos/lib"]) {
  Fs.mkdirSync(`${deepSrc}/${lib}`, { recursive: true });
}

Fs.mkdirSync(`${webSrc}/features/notes/lib`, { recursive: true });

afterAll(() => Fs.rmSync(root, { recursive: true, force: true }));

const notesIndex = `${deepSrc}/modules/notes/index.ts`;
const notesLib = `${deepSrc}/modules/notes/lib/notes.ts`;
const notesTest = `${deepSrc}/modules/notes/notes.test.ts`;
const testingModule = `${deepSrc}/modules/testing/index.ts`;
const otherModule = `${deepSrc}/modules/todos/lib/todos.ts`;
const webRoute = `${webSrc}/routes/notes.tsx`;
const webFeature = `${webSrc}/features/todos/todos-list.tsx`;

const NO_OTHER_LAYER = { message: "The domain depends on no other layer." };
const NO_PLATFORM = { message: "The domain stays free of platform and transport code." };

const DOMAIN_ONLY = {
  message: "Use cases depend on the domain only. Adapters are provided as Layers.",
};

const TESTS_ONLY = {
  message: "Only a test or another testing/ file imports from a testing/ folder.",
};

const TESTS_ONLY_ACROSS = { message: "Only a test imports another module's testing/ folder." };

const throughIndex = (module: string, folder = "modules") => ({
  message: `Import another module through its index.ts (#/${folder}/${module}/index.ts), not its internals.`,
});

new RuleTester().run("module-boundaries", rule, {
  valid: [
    { filename: domain, code: `import { TodoId } from "#/modules/todos/domain/todo-errors.ts";` },
    { filename: domain, code: `import { Schema } from "effect";` },
    { filename: domain, code: `import { Schema } from "effect/Schema";` },
    { filename: application, code: `import { Todo } from "#/modules/todos/domain/todo.ts";` },
    {
      filename: application,
      code: `import { Other } from "#/modules/todos/application/other.ts";`,
    },
    { filename: application, code: `import * as Crypto from "node:crypto";` },
    { filename: infrastructure, code: `import { Todo } from "#/modules/todos/domain/todo.ts";` },
    { filename: infrastructure, code: `import * as Fs from "node:fs";` },
    { filename: http, code: `import { Todos } from "#/modules/todos/application/todos.ts";` },
    { filename: http, code: `import { HttpApiBuilder } from "effect/http-api";` },
    { filename: http, code: `import { Api } from "#/api.ts";` },
    { filename: index, code: `import { Todos } from "#/modules/todos/application/todos.ts";` },
    { filename: index, code: `import { Repo } from "#/modules/todos/infrastructure/repo.ts";` },
    { filename: application, code: `import { UsersModule } from "#/modules/users/index.ts";` },
    { filename: http, code: `export { UsersModule } from "#/modules/users/index.ts";` },
    { filename: index, code: `export const load = () => import("#/modules/users/index.ts");` },
    {
      filename: `${src}/server.ts`,
      code: `import { TodosModule } from "#/modules/todos/index.ts";`,
    },
    { filename: `${src}/server.ts`, code: `import * as Http from "node:http";` },
    {
      filename: "/repo/apps/web/src/features/todos/queries.ts",
      code: `import { callApi } from "#/lib/api";`,
    },
    {
      filename: infrastructureTest,
      code: `import { todoRepositorySuite } from "#/modules/todos/testing/todo-repository-suite.ts";`,
    },
    {
      filename: domainTest,
      code: `import { aTodo } from "#/modules/todos/testing/todos.ts";`,
    },
    {
      filename: testing,
      code: `import { aTodo } from "#/modules/todos/testing/todos.ts";`,
    },
    {
      filename: testing,
      code: `import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";`,
    },
    {
      filename: httpTest,
      code: `import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";`,
    },
    {
      filename: routesTest,
      code: `import { TodoRepositoryMemory } from "#/modules/todos/testing/todo-repository-memory.ts";`,
    },
    { filename: notesIndex, code: `import { Notes } from "#/modules/notes/lib/notes.ts";` },
    { filename: notesLib, code: `import { NotesSeed } from "#/modules/notes/lib/notes-seed.ts";` },
    { filename: notesLib, code: `import { Note } from "./note.ts";` },
    { filename: notesTest, code: `import { NotesModule } from "#/modules/notes/index.ts";` },
    ...[otherModule, `${deepSrc}/server.ts`, testingModule, `${deepSrc}/server.test.ts`].map(
      (filename) => ({ filename, code: `import { NotesModule } from "#/modules/notes/index.ts";` }),
    ),
    { filename: testingModule, code: `import { Notes } from "#/modules/notes/lib/notes.ts";` },
    {
      filename: `${deepSrc}/modules/testing/lib/users.ts`,
      code: `import { Notes } from "#/modules/notes/lib/notes.ts";`,
    },
    { filename: webRoute, code: `import { NotesList } from "#/features/notes/index.ts";` },
    { filename: webFeature, code: `import { NotesList } from "#/features/notes/index";` },
    // A web feature without lib/ has no layers to keep apart yet.
    { filename: webRoute, code: `import { TodosList } from "#/features/todos/todos-list.tsx";` },
  ],
  invalid: [
    ...[domain, application, infrastructure, http, index, `${src}/main.ts`].map((filename) => ({
      filename,
      code: `import { aTodo } from "#/modules/todos/testing/todos.ts";`,
      errors: [TESTS_ONLY],
    })),
    {
      filename: infrastructure,
      code: `export const load = () => import("../testing/todos.ts");`,
      errors: [TESTS_ONLY],
    },
    {
      filename: testing,
      code: `import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";`,
      errors: [TESTS_ONLY_ACROSS],
    },
    {
      filename: testing,
      code: `import { User } from "#/modules/identity/domain/user.ts";`,
      errors: [throughIndex("identity")],
    },
    {
      filename: domain,
      code: `import { Todos } from "#/modules/todos/application/todos.ts";`,
      errors: [NO_OTHER_LAYER],
    },
    {
      filename: domain,
      code: `import { Repo } from "#/modules/todos/infrastructure/repo.ts";`,
      errors: [NO_OTHER_LAYER],
    },
    {
      filename: domain,
      code: `export { TodosApi } from "#/modules/todos/http/todos-api.ts";`,
      errors: [NO_OTHER_LAYER],
    },
    {
      filename: domain,
      code: `export const load = () => import("#/modules/todos/http/todos-api.ts");`,
      errors: [NO_OTHER_LAYER],
    },
    // Relative paths are resolved too, so the boundary holds on its own.
    {
      filename: domain,
      code: `import { Todos } from "../application/todos.ts";`,
      errors: [NO_OTHER_LAYER],
    },
    { filename: domain, code: `import * as Fs from "node:fs";`, errors: [NO_PLATFORM] },
    {
      filename: domain,
      code: `import { NodeHttpServer } from "@effect/platform-node";`,
      errors: [NO_PLATFORM],
    },
    { filename: domain, code: `import { HttpRouter } from "effect/http";`, errors: [NO_PLATFORM] },
    {
      filename: domain,
      code: `import { HttpApiSchema } from "effect/http-api";`,
      errors: [NO_PLATFORM],
    },
    { filename: domain, code: `export * from "effect/http-api";`, errors: [NO_PLATFORM] },
    {
      filename: domain,
      code: `export const load = () => import("node:fs");`,
      errors: [NO_PLATFORM],
    },
    {
      filename: application,
      code: `import { Repo } from "#/modules/todos/infrastructure/repo.ts";`,
      errors: [DOMAIN_ONLY],
    },
    {
      filename: application,
      code: `import { TodosApi } from "#/modules/todos/http/todos-api.ts";`,
      errors: [DOMAIN_ONLY],
    },
    {
      filename: application,
      code: `export * from "#/modules/todos/infrastructure/repo.ts";`,
      errors: [DOMAIN_ONLY],
    },
    {
      filename: application,
      code: `export const load = () => import("#/modules/todos/http/todos-api.ts");`,
      errors: [DOMAIN_ONLY],
    },
    ...[domain, application, infrastructure, http, index].map((filename) => ({
      filename,
      code: `import { User } from "#/modules/users/domain/user.ts";`,
      errors: [throughIndex("users")],
    })),
    {
      filename: http,
      code: `export { Users } from "#/modules/users/application/users.ts";`,
      errors: [throughIndex("users")],
    },
    {
      filename: infrastructure,
      code: `export const load = () => import("#/modules/users/infrastructure/repo.ts");`,
      errors: [throughIndex("users")],
    },
    {
      filename: application,
      code: `import { User } from "../../users/domain/user.ts";`,
      errors: [throughIndex("users")],
    },
    ...[`${src}/server.ts`, `${src}/mcp/mcp-endpoint.ts`, routesTest].map((filename) => ({
      filename,
      code: `import { TodosHandlers } from "#/modules/todos/http/todos-handlers.ts";`,
      errors: [throughIndex("todos")],
    })),
    ...[otherModule, `${deepSrc}/server.ts`, `${deepSrc}/server.test.ts`].map((filename) => ({
      filename,
      code: `import { Notes } from "#/modules/notes/lib/notes.ts";`,
      errors: [throughIndex("notes")],
    })),
    {
      filename: otherModule,
      code: `export const load = () => import("../../notes/lib/notes.ts");`,
      errors: [throughIndex("notes")],
    },
    // Past its index.ts, a module with a lib/ is closed to all, a file at its root included.
    {
      filename: testingModule,
      code: `import { NotesSeed } from "#/modules/notes/notes-seed.ts";`,
      errors: [throughIndex("notes")],
    },
    {
      filename: notesTest,
      code: `import { Todos } from "#/modules/todos/lib/todos.ts";`,
      errors: [throughIndex("todos")],
    },
    ...[webRoute, webFeature].map((filename) => ({
      filename,
      code: `import { NotesList } from "#/features/notes/lib/notes-list.tsx";`,
      errors: [throughIndex("notes", "features")],
    })),
  ],
});
