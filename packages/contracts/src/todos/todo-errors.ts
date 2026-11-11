import { Schema } from "effect";

import { TodoId } from "#/todos/todo.ts";

export class TodoNotFound extends Schema.TaggedError<
  TodoNotFound,
  { readonly brand: unique symbol }
>()("TodoNotFound", {
  id: TodoId,
}) {}
