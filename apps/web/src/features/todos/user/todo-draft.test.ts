import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { TodoDraft } from "#/features/todos/user/todo-draft.ts";

const validate = (title: string) =>
  Schema.toStandardSchemaV1(TodoDraft)["~standard"].validate({ title });

describe("TodoDraft", () => {
  it("trims surrounding whitespace", () => {
    expect(validate("  Ship it  ")).toEqual({ value: { title: "Ship it" } });
  });

  it("measures the title after trimming", () => {
    const longest = "x".repeat(120);
    expect(validate(` ${longest} `)).toEqual({ value: { title: longest } });
  });

  it("reports blank and overlong titles on the title field", () => {
    expect(validate("   ")).toMatchObject({
      issues: [{ path: ["title"], message: "Title is required" }],
    });
    expect(validate("x".repeat(121))).toMatchObject({
      issues: [{ path: ["title"], message: "Title must be at most 120 characters" }],
    });
  });
});
