import { Todo } from "@quack/contracts/todos/Todo";

/** Completing is idempotent: a completed todo is returned as is. */
export const completeTodo = (todo: Todo): Todo =>
  todo.completed ? todo : new Todo({ ...todo, completed: true });
