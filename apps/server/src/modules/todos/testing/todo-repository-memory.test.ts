import { UserId } from "@quack/contracts/identity/user";
import { Effect } from "effect";

import { TodoRepositoryMemory } from "#/modules/todos/testing/todo-repository-memory.ts";
import { todoRepositorySuite } from "#/modules/todos/testing/todo-repository-suite.ts";

todoRepositorySuite(
  TodoRepositoryMemory,
  Effect.sync(() => UserId.make(crypto.randomUUID())),
);
