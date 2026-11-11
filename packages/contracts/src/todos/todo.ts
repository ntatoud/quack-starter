import { Schema } from "effect";

export const TodoId = Schema.String.pipe(Schema.brand("TodoId"));
export type TodoId = typeof TodoId.Type;

export const TodoTitle = Schema.Trimmed.check(Schema.isNonEmpty(), Schema.isMaxLength(120)).pipe(
  Schema.brand("TodoTitle"),
);
export type TodoTitle = typeof TodoTitle.Type;

export class Todo extends Schema.Class<Todo, { readonly brand: unique symbol }>("Todo")({
  id: TodoId,
  title: TodoTitle,
  completed: Schema.Boolean,
  createdAt: Schema.DateTimeUtcFromString,
}) {}
