import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

import rule from "#/rules/module-boundaries.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const src = "/repo/apps/server/src";
const domain = `${src}/modules/todos/domain/Todo.ts`;
const application = `${src}/modules/todos/application/Todos.ts`;
const infrastructure = `${src}/modules/todos/infrastructure/TodoRepositoryMemory.ts`;
const http = `${src}/modules/todos/http/TodosHandlers.ts`;
const index = `${src}/modules/todos/index.ts`;

const NO_OTHER_LAYER = { message: "The domain depends on no other layer." };
const NO_PLATFORM = { message: "The domain stays free of platform and transport code." };
const DOMAIN_ONLY = {
  message: "Use cases depend on the domain only. Adapters are provided as Layers.",
};
const throughIndex = (module: string) => ({
  message: `Import another module through its index.ts (#/modules/${module}/index.ts), not its internals.`,
});

new RuleTester().run("module-boundaries", rule, {
  valid: [
    // Domain: itself and pure packages.
    { filename: domain, code: `import { TodoId } from "#/modules/todos/domain/todo-errors.ts";` },
    { filename: domain, code: `import { Schema } from "effect";` },
    { filename: domain, code: `import { Schema } from "effect/Schema";` },
    // Application: the domain and itself.
    { filename: application, code: `import { Todo } from "#/modules/todos/domain/todo.ts";` },
    {
      filename: application,
      code: `import { Other } from "#/modules/todos/application/other.ts";`,
    },
    { filename: application, code: `import * as Crypto from "node:crypto";` },
    // Infrastructure and http: every layer of their own module.
    { filename: infrastructure, code: `import { Todo } from "#/modules/todos/domain/todo.ts";` },
    { filename: infrastructure, code: `import * as Fs from "node:fs";` },
    { filename: http, code: `import { Todos } from "#/modules/todos/application/todos.ts";` },
    { filename: http, code: `import { HttpApiBuilder } from "effect/http-api";` },
    { filename: http, code: `import { Api } from "#/api.ts";` },
    // The module's index.ts assembles its own layers.
    { filename: index, code: `import { Todos } from "#/modules/todos/application/todos.ts";` },
    { filename: index, code: `import { Repo } from "#/modules/todos/infrastructure/repo.ts";` },
    // Another module, through its index.ts.
    { filename: application, code: `import { UsersModule } from "#/modules/users/index.ts";` },
    { filename: http, code: `export { UsersModule } from "#/modules/users/index.ts";` },
    { filename: index, code: `export const load = () => import("#/modules/users/index.ts");` },
    // Files outside a module compose the modules freely.
    {
      filename: `${src}/api.ts`,
      code: `import { TodosApi } from "#/modules/todos/http/todos-api.ts";`,
    },
    { filename: `${src}/server.ts`, code: `import * as Http from "node:http";` },
    // Other packages have no modules folder to guard.
    {
      filename: "/repo/apps/web/src/features/todos/queries.ts",
      code: `import { callApi } from "#/lib/api";`,
    },
  ],
  invalid: [
    // Domain: no other layer of its module.
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
    // Domain: no platform, no transport.
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
    // Application: the domain only.
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
    // Another module's layers, from every layer and from index.ts.
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
  ],
});
