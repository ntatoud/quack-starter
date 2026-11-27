import { Layer } from "effect";

import { TodosHandlers } from "#/modules/todos/todos-handlers.ts";
import { Todos } from "#/modules/todos/todos.ts";

export { TodosSeed } from "#/modules/todos/todos-seed.ts";

/** The Todos endpoints of the `Api`. Needs the database. */
export const TodosModule = TodosHandlers.pipe(Layer.provide(Todos.layer));
