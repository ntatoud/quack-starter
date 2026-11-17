import { Layer } from "effect";

import { Todos } from "#/modules/todos/application/todos.ts";
import { TodosHandlers } from "#/modules/todos/http/todos-handlers.ts";

export const TodosModule = TodosHandlers.pipe(Layer.provide(Todos.layer));
