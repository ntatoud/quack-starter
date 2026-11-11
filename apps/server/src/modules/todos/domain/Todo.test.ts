import { assert, describe, it } from "@effect/vitest";
import { Todo, TodoId, TodoTitle } from "@quack/contracts/todos/Todo";
import { DateTime } from "effect";

import { completeTodo } from "#/modules/todos/domain/Todo.ts";

const todo = new Todo({
  id: TodoId.make("todo-1"),
  title: TodoTitle.make("Write the docs"),
  completed: false,
  createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
});

describe("completeTodo", () => {
  it("completes without mutating the original", () => {
    const completed = completeTodo(todo);

    assert.isTrue(completed.completed);
    assert.isFalse(todo.completed);
  });

  it("returns an already completed todo as is", () => {
    const completed = completeTodo(todo);

    assert.strictEqual(completeTodo(completed), completed);
  });
});
