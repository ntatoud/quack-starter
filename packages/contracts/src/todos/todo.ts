import { Schema } from "effect";

import { UserId } from "#/identity/user.ts";

export const TodoId = Schema.String.pipe(Schema.brand("TodoId"));
export type TodoId = typeof TodoId.Type;

export const TodoTitle = Schema.Trimmed.check(
  Schema.isNonEmpty({ message: "Title is required" }),
  Schema.isMaxLength(120, { message: "Title must be at most 120 characters" }),
).pipe(Schema.brand("TodoTitle"));
export type TodoTitle = typeof TodoTitle.Type;

export class Todo extends Schema.Class<Todo, { readonly brand: unique symbol }>("Todo")({
  id: TodoId,
  /** The Owner: the User who created the Todo, and the only one who sees it. */
  ownerId: UserId,
  title: TodoTitle,
  completed: Schema.Boolean,
  createdAt: Schema.DateTimeUtcFromString,
}) {}
