import { Schema } from "effect";

/** `todos:write` creates and completes a Todo; `todos:delete` removes one. */
export const TodosPermission = Schema.Literals(["todos:list", "todos:write", "todos:delete"]);
export type TodosPermission = typeof TodosPermission.Type;
