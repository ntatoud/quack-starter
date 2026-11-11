import { HttpApi, OpenApi } from "effect/http-api";

import { SystemApi } from "#/system/system-api.ts";
import { TodosApi } from "#/todos/todos-api.ts";

/** The path every endpoint is under. The web app relays it to the server, so both share one origin. */
export const apiPrefix = "/api";

/**
 * The HTTP contract. The server implements it; the web app derives its client from it.
 * Every endpoint is under `apiPrefix`.
 */
export class Api extends HttpApi.make("quack")
  .add(SystemApi)
  .add(TodosApi)
  .prefix(apiPrefix)
  .annotateMerge(OpenApi.annotations({ title: "Quack API" })) {}
