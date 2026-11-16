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

  it("orders by email, role, or status, ascending or descending, nothing else", () => {
    expect(decode({ orderBy: "role", dir: "desc" })._tag).toBe("Some");
    expect(decode({ orderBy: "status" })._tag).toBe("Some");
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

  it("filters by a Role and a status, nothing else", () => {
    expect(Schema.decodeSync(UserListQuery)({ role: "admin" }).role).toBe("admin");
    expect(Schema.decodeSync(UserListQuery)({ status: "suspended" }).status).toBe("suspended");
    expect(decode({ role: "owner" })._tag).toBe("None");
    expect(decode({ status: "deleted" })._tag).toBe("None");
  });
});
