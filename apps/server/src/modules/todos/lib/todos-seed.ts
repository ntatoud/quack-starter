import type { Api } from "@quack/contracts/api";
import { TodoTitle } from "@quack/contracts/todos/todo";
import { Effect } from "effect";
import type { HttpApiClient } from "effect/http-api";

const drafts = [
  { title: "Read the README", completed: true },
  { title: "Start Postgres with pnpm dev", completed: true },
  { title: "Add a module, copied from todos", completed: false },
  { title: "Rebrand the app in @quack/brand", completed: false },
  { title: "Deploy the app", completed: false },
] as const;

export const seedTodos = Effect.fn("seedTodos")(function* (
  todos: HttpApiClient.ForApi<typeof Api>["todos"],
) {
  for (const { title, completed } of drafts) {
    const todo = yield* todos.create({ payload: { title: TodoTitle.make(title) } });

    if (completed) {
      yield* todos.complete({ params: { id: todo.id } });
    }
  }

  yield* Effect.logInfo(`Seeded ${drafts.length} Todos`);
});
