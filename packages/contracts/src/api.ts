import { HttpApi, OpenApi } from "effect/http-api";

import { IdentityApi } from "#/identity/identity-api.ts";
import { SystemApi } from "#/system/system-api.ts";
import { TodosApi } from "#/todos/todos-api.ts";

/** The path every endpoint is under. The web app relays it to the server, so both share one origin. */
export const API_PREFIX = "/api";

/**
 * The HTTP contract. The server implements it; the web app derives its client from it.
 * Every endpoint is under `API_PREFIX`.
 */
export class Api extends HttpApi.make("quack")
  .add(SystemApi)
  .add(IdentityApi)
  .add(TodosApi)
  .prefix(API_PREFIX)
  .annotateMerge(OpenApi.annotations({ title: "Quack API" })) {}
