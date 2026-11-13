import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { UserId } from "#/identity/user.ts";
import { Todo, TodoId, TodoTitle } from "#/todos/todo.ts";

describe("TodoTitle", () => {
  it("rejects empty, untrimmed, and overlong titles", () => {
    const decode = Schema.decodeUnknownOption(TodoTitle);

    expect(decode("Ship it")._tag).toBe("Some");
    expect(decode("")._tag).toBe("None");
    expect(decode(" Ship it ")._tag).toBe("None");
    expect(decode("x".repeat(121))._tag).toBe("None");
  });
});

describe("Todo", () => {
  it("round-trips through its wire format", () => {
    const todo = new Todo({
      id: TodoId.make("todo-1"),
      ownerId: UserId.make("user-1"),
      title: TodoTitle.make("Write the docs"),
      completed: false,
      createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
    });

    const wire = Schema.encodeSync(Todo)(todo);
    expect(wire.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(Schema.decodeSync(Todo)(wire)).toStrictEqual(todo);
  });
});
