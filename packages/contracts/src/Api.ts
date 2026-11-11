import { HttpApi, OpenApi } from "effect/http-api";

import { SystemApi } from "#/system/SystemApi.ts";
import { TodosApi } from "#/todos/TodosApi.ts";

/** The HTTP contract. The server implements it; the web app derives its client from it. */
export class Api extends HttpApi.make("quack")
  .add(SystemApi)
  .add(TodosApi)
  .annotateMerge(OpenApi.annotations({ title: "Quack API" })) {}
