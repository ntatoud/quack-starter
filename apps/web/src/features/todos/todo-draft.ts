import { TodoTitle } from "@quack/contracts/todos/todo";
import { Schema } from "effect";

/** Trimmed first: surrounding whitespace is not a mistake to report. */
export const TodoDraft = Schema.Struct({
  title: Schema.Trim.pipe(Schema.decodeTo(TodoTitle)),
});
