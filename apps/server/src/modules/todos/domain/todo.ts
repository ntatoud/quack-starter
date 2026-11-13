import { Todo } from "@quack/contracts/todos/todo";

export const completeTodo = (todo: Todo): Todo =>
  todo.completed ? todo : new Todo({ ...todo, completed: true });
