import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import { RequiredPermission } from "#/permission.ts";
import { Todo, TodoId, TodoTitle } from "#/todos/todo.ts";
import { TodoNotFound } from "#/todos/todo-errors.ts";

const NotFound = TodoNotFound.pipe(HttpApiSchema.status(404));

export class TodosApi extends HttpApiGroup.make("todos")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(Todo),
    }).annotate(RequiredPermission, "todos:list"),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({ title: TodoTitle }),
      success: Todo,
    }).annotate(RequiredPermission, "todos:write"),
    HttpApiEndpoint.post("complete", "/:id/complete", {
      params: { id: TodoId },
      success: Todo,
      error: NotFound,
    }).annotate(RequiredPermission, "todos:write"),
    HttpApiEndpoint.delete("remove", "/:id", {
      params: { id: TodoId },
      success: HttpApiSchema.NoContent,
      error: NotFound,
    }).annotate(RequiredPermission, "todos:delete"),
  )
  .middleware(Authentication)
  .prefix("/todos") {}
