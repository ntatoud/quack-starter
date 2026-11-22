import { Layer } from "effect";

import { Todos } from "#/modules/todos/application/todos.ts";
import { TodosSeed } from "#/modules/todos/application/todos-seed.ts";
import { TodosHandlers } from "#/modules/todos/http/todos-handlers.ts";
import { TodoRepositoryPostgres } from "#/modules/todos/infrastructure/todo-repository-postgres.ts";

export { TodosSeed };

export const TodosPostgres = TodoRepositoryPostgres;

export const TodosModule = TodosHandlers.pipe(Layer.provide(Todos.layer));
