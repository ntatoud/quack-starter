import { Schema } from "effect";

import { TodoId } from "#/todos/Todo.ts";

export class TodoNotFound extends Schema.TaggedError<
  TodoNotFound,
  { readonly brand: unique symbol }
>()("TodoNotFound", {
  id: TodoId,
}) {}
