import { HttpApi, OpenApi } from "effect/http-api";

import { SystemApi } from "#/system/system-api.ts";
import { TodosApi } from "#/todos/todos-api.ts";

/**
 * The HTTP contract. The server implements it; the web app derives its client from it.
 * Every endpoint is under `/api`: the web app relays that prefix to the server, so both share one origin.
 */
export class Api extends HttpApi.make("quack")
  .add(SystemApi)
  .add(TodosApi)
  .prefix("/api")
  .annotateMerge(OpenApi.annotations({ title: "Quack API" })) {}
