import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@quack/ui/components/empty";
import { matchQuery } from "@quack/ui-state/query";
import { useQuery } from "@tanstack/react-query";
import { Option } from "effect";
import { ListTodoIcon } from "lucide-react";

import { ListLoading } from "#/components/list-loading.tsx";
import { LoadFailed } from "#/components/load-failed.tsx";
import { RefreshFailed } from "#/components/refresh-failed.tsx";
import { TodoItem } from "#/features/todos/todo-item.tsx";
import { api } from "#/lib/api.ts";

export function TodosList() {
  const todos = useQuery(api.todos.list.queryOptions());

  return matchQuery(todos, {
    Pending: () => <ListLoading label="Loading todos…" />,
    Error: () => (
      <LoadFailed
        title="Could not load your todos"
        retrying={todos.isFetching}
        onRetry={() => todos.refetch()}
      />
    ),
    Success: ({ data, refreshError }) => (
      <div className="flex flex-col gap-4">
        {Option.isSome(refreshError) && (
          <RefreshFailed
            message="Could not refresh your todos."
            retrying={todos.isFetching}
            onRetry={() => todos.refetch()}
          />
        )}
        {data.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListTodoIcon />
              </EmptyMedia>
              <EmptyTitle>No todos yet</EmptyTitle>
              <EmptyDescription>Add your first one above.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y rounded-xl border">
            {data.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}
          </ul>
        )}
      </div>
    ),
  });
}
