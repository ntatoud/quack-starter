import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "#/features/layout/page-header.tsx";
import { TodosForm } from "#/features/todos/todos-form.tsx";
import { TodosList } from "#/features/todos/todos-list.tsx";
import { api } from "#/lib/api.ts";

export function TodosPage() {
  const todos = useQuery(api.todos.list.queryOptions());
  const left = todos.data?.filter((todo) => !todo.completed).length;

  return (
    <>
      <PageHeader>
        <h1 className="text-sm font-medium">Todos</h1>
        {left !== undefined && (
          <span className="ml-auto text-sm text-muted-foreground">{left} left</span>
        )}
      </PageHeader>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <TodosForm />
        <TodosList />
      </div>
    </>
  );
}
