import { TodoTitle } from "@quack/contracts/todos/Todo";
import { type Option, Schema } from "effect";

const decodeTitle = Schema.decodeOption(TodoTitle);

/** Applies the server's own title rules to what the user typed, so the form and the API agree. */
export const parseDraftTitle = (draft: string): Option.Option<TodoTitle> =>
  decodeTitle(draft.trim());
