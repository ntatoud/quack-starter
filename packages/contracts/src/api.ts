import { HttpApi, OpenApi } from "effect/http-api";

import { IdentityApi } from "#/identity/identity-api.ts";
import { OAuthApi } from "#/oauth/oauth-api.ts";
import { SystemApi } from "#/system/system-api.ts";
import { TodosApi } from "#/todos/todos-api.ts";
import { UsersApi } from "#/users/users-api.ts";

export const API_PREFIX = "/api";

/** Where AI Clients reach Quack over MCP: served by the server, beside the `Api`. */
export const MCP_PATH = `${API_PREFIX}/mcp`;

export class Api extends HttpApi.make("quack")
  .add(SystemApi)
  .add(IdentityApi)
  .add(TodosApi)
  .add(UsersApi)
  .add(OAuthApi)
  .prefix(API_PREFIX)
  .annotateMerge(OpenApi.annotations({ title: "Quack API" })) {}
