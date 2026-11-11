import { Button } from "@quack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quack/ui/components/card";
import { Checkbox } from "@quack/ui/components/checkbox";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";

import { invalidateTodos } from "#/features/todos/invalidate-todos.ts";
import { TodosForm } from "#/features/todos/todos-form.tsx";
import { api } from "#/lib/api.ts";

export function TodosCard() {
  const todos = useQuery(api.todos.list.queryOptions());
  const completeTodo = useMutation(api.todos.complete.mutationOptions(invalidateTodos));
  const removeTodo = useMutation(api.todos.remove.mutationOptions(invalidateTodos));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Todos</CardTitle>
        <CardDescription>Served by the Effect API, typed end to end.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TodosForm />

        {todos.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {todos.isError && (
          <p className="text-sm text-destructive">
            Could not reach the API. Is the server running?
          </p>
        )}
        {todos.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing yet. Add your first todo.</p>
        )}

        <ul className="flex flex-col gap-2">
          {todos.data?.map((todo) => (
            <li key={todo.id} className="flex items-center gap-3">
              <Checkbox
                checked={todo.completed}
                disabled={todo.completed}
                onCheckedChange={() => completeTodo.mutate({ params: { id: todo.id } })}
                aria-label={`Complete ${todo.title}`}
              />
              <span
                className={todo.completed ? "flex-1 text-muted-foreground line-through" : "flex-1"}
              >
                {todo.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeTodo.mutate({ params: { id: todo.id } })}
                aria-label={`Remove ${todo.title}`}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
