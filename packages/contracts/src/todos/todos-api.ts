import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { McpTool } from "#/mcp-tool.ts";
import { RequiredPermission } from "#/permission.ts";
import { Todo, TodoId, TodoTitle } from "#/todos/todo.ts";
import { TodoNotFound } from "#/todos/todo-errors.ts";

const NotFound = TodoNotFound.pipe(HttpApiSchema.status(404));

export class TodosApi extends HttpApiGroup.make("todos")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(Todo),
    })
      .annotate(OpenApi.Description, "Lists the Todos of the Current User, oldest first.")
      .annotate(RequiredPermission, "todos:list"),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({ title: TodoTitle }),
      success: Todo,
    })
      .annotate(OpenApi.Description, "Creates a Todo with this title, not completed yet.")
      .annotate(RequiredPermission, "todos:write"),
    HttpApiEndpoint.post("complete", "/:id/complete", {
      params: { id: TodoId },
      success: Todo,
      error: NotFound,
    })
      .annotate(OpenApi.Description, "Marks the Todo with this id as completed.")
      .annotate(RequiredPermission, "todos:write")
      .annotate(McpTool, { idempotent: true }),
    HttpApiEndpoint.delete("remove", "/:id", {
      params: { id: TodoId },
      success: HttpApiSchema.NoContent,
      error: NotFound,
    })
      .annotate(OpenApi.Description, "Removes the Todo with this id, for good.")
      .annotate(RequiredPermission, "todos:delete"),
  )
  .middleware(Authentication)
  .annotate(McpTool, {})
  .prefix("/todos") {}
