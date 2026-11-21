import { useQuery } from "@tanstack/react-query";

import { PageContent } from "#/features/layout/page-content.tsx";
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
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {remaining} left
          </span>
        )}
      </PageHeader>
      <PageContent className="max-w-2xl">
        <TodosForm />
        <TodosList />
      </PageContent>
    </>
  );
}
