import { Effect, Layer } from "effect";

import { IdentityPostgres } from "#/modules/identity/index.ts";
import { aUser, TestDatabase } from "#/modules/testing/index.ts";
import { TodoRepositoryPostgres } from "#/modules/todos/infrastructure/todo-repository-postgres.ts";
import { todoRepositorySuite } from "#/modules/todos/testing/todo-repository-suite.ts";

todoRepositorySuite(
  Layer.mergeAll(TodoRepositoryPostgres, IdentityPostgres).pipe(Layer.provide(TestDatabase)),
  Effect.map(aUser(), ({ id }) => id),
);
