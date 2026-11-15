import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { UserListQuery } from "#/users/users-api.ts";

describe("UserListQuery", () => {
  const decode = Schema.decodeUnknownOption(UserListQuery);

  it("sorts by email, ascending, when the query says nothing", () => {
    expect(Schema.decodeUnknownSync(UserListQuery)({})).toEqual({
      page: 1,
      pageSize: 20,
      orderBy: "email",
      dir: "asc",
    });
  });

  it("orders by email or role, ascending or descending, nothing else", () => {
    expect(decode({ orderBy: "role", dir: "desc" })._tag).toBe("Some");
    expect(decode({ orderBy: "id" })._tag).toBe("None");
    expect(decode({ orderBy: "Email" })._tag).toBe("None");
    expect(decode({ dir: "up" })._tag).toBe("None");
  });

  it("trims and lowercases the search, up to the length of an email", () => {
    expect(Schema.decodeSync(UserListQuery)({ search: "  Ada@Example " }).search).toBe(
      "ada@example",
    );
    expect(decode({ search: "a".repeat(254) })._tag).toBe("Some");
    expect(decode({ search: "a".repeat(255) })._tag).toBe("None");
  });
});
