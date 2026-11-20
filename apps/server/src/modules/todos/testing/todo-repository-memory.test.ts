import { TodoRepositoryMemory } from "#/modules/todos/testing/todo-repository-memory.ts";
import { todoRepositorySuite } from "#/modules/todos/testing/todo-repository-suite.ts";

todoRepositorySuite(TodoRepositoryMemory);
