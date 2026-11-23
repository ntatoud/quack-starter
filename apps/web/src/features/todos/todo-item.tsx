import type { Todo } from "@quack/contracts/todos/todo";
import { Button } from "@quack/ui/components/button";
import { Checkbox } from "@quack/ui/components/checkbox";
import { useMutation } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";

import { invalidateTodos } from "#/features/todos/invalidate-todos.ts";
import { todoItemMachine } from "#/features/todos/todo-item-machine.ts";
import { api } from "#/lib/api.ts";
import { useFsm } from "#/lib/use-fsm.ts";

export function TodoItem({ todo }: { todo: Todo }) {
  const [state, send] = useFsm(todoItemMachine);
  const completeTodo = useMutation(api.todos.complete.mutationOptions(invalidateTodos));
  const removeTodo = useMutation(api.todos.remove.mutationOptions(invalidateTodos));

  const settled = {
    onSuccess: () => send({ type: "succeeded" }),
    onError: () => send({ type: "failed" }),
  };

  const busy = state.value === "completing" || state.value === "removing";

  return (
    <li className="group/todo flex items-center gap-3 py-3 pr-3 pl-5" aria-busy={busy}>
      <Checkbox
        checked={todo.completed}
        disabled={todo.completed || busy}
        onCheckedChange={() => {
          if (send({ type: "complete" })) completeTodo.mutate({ params: { id: todo.id } }, settled);
        }}
        aria-label={`Complete ${todo.title}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={
            todo.completed
              ? "text-sm wrap-anywhere text-muted-foreground line-through"
              : "text-sm wrap-anywhere"
          }
        >
          {todo.title}
        </span>
        {state.value === "failed" && (
          <span role="alert" className="text-sm text-destructive">
            {state.context.failedTo === "complete"
              ? "Could not complete this todo. Try again."
              : "Could not remove this todo. Try again."}
          </span>
        )}
      </div>
      {/* Hidden until hover only on a wide screen with a mouse: a touch screen would never show it, and a phone's layout,
          also seen in a narrow window or a browser's device mode that keeps the mouse, always shows it. */}
      {/* `-my-1`: the title sets the height of the row, not the button. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="-my-1 md:pointer-fine:opacity-0 md:pointer-fine:group-focus-within/todo:opacity-100 md:pointer-fine:group-hover/todo:opacity-100"
        disabled={busy}
        onClick={() => {
          if (send({ type: "remove" })) removeTodo.mutate({ params: { id: todo.id } }, settled);
        }}
        aria-label={`Remove ${todo.title}`}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
