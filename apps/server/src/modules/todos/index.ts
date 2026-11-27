import { Layer } from "effect";

import { TodosHandlers } from "#/modules/todos/lib/todos-handlers.ts";
import { Todos } from "#/modules/todos/lib/todos.ts";

export { seedTodos } from "#/modules/todos/lib/todos-seed.ts";

/** The Todos endpoints of the `Api`. Requires the database. */
export const TodosModule = TodosHandlers.pipe(Layer.provide(Todos.layer));
