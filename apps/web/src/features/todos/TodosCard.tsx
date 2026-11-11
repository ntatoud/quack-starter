import { Button } from "@quack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quack/ui/components/card";
import { Checkbox } from "@quack/ui/components/checkbox";
import { Input } from "@quack/ui/components/input";
import { type MutationFunctionContext, useMutation, useQuery } from "@tanstack/react-query";
import { Option } from "effect";
import { Trash2Icon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { parseDraftTitle } from "#/features/todos/draft.ts";
import { api } from "#/lib/api.ts";

// Every mutation changes the list, so each one refetches the todos queries, even after a failure.
const refresh = {
  onSettled: (
    _data: unknown,
    _error: unknown,
    _input: unknown,
    _onMutateResult: unknown,
    { client }: MutationFunctionContext,
  ) => client.invalidateQueries({ queryKey: api.todos.key() }),
};

export function TodosCard() {
  const todos = useQuery(api.todos.list.queryOptions());
  const createTodo = useMutation(api.todos.create.mutationOptions(refresh));
  const completeTodo = useMutation(api.todos.complete.mutationOptions(refresh));
  const removeTodo = useMutation(api.todos.remove.mutationOptions(refresh));
  const [draft, setDraft] = useState("");

  const title = parseDraftTitle(draft);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (Option.isNone(title)) return;
    createTodo.mutate({ payload: { title: title.value } }, { onSuccess: () => setDraft("") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Todos</CardTitle>
        <CardDescription>Served by the Effect API, typed end to end.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What needs doing?"
            aria-label="New todo"
          />
          <Button type="submit" disabled={Option.isNone(title) || createTodo.isPending}>
            Add
          </Button>
        </form>

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
