import { TodoTitle } from "@quack/contracts/todos/todo";
import { Schema } from "effect";

/**
 * What the new-todo form holds, decoded with the server's own title rules so the form and the API agree.
 * The title is trimmed first: surrounding whitespace is not a mistake to report.
 */
export const TodoDraft = Schema.Struct({
  title: Schema.Trim.pipe(Schema.decodeTo(TodoTitle)),
});
