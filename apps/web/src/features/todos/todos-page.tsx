import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "#/features/layout/page-header.tsx";
import { TodosForm } from "#/features/todos/todos-form.tsx";
import { TodosList } from "#/features/todos/todos-list.tsx";
import { api } from "#/lib/api.ts";

export function TodosPage() {
  const todos = useQuery(api.todos.list.queryOptions());
  const all = todos.data ?? [];
  const remaining = all.filter((todo) => !todo.completed).length;

  return (
    <>
      <PageHeader title="Todos">
        {all.length > 0 && (
          <span className="ml-auto text-sm text-muted-foreground">{remaining} left</span>
        )}
      </PageHeader>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <TodosForm />
        <TodosList />
      </div>
    </>
  );
}
