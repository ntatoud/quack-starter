import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { UsersPageQuery } from "#/users/users-api.ts";

describe("UsersPageQuery", () => {
  const decode = Schema.decodeUnknownOption(UsersPageQuery);

  it("asks for the first page of 20 when the query says nothing", () => {
    expect(Schema.decodeUnknownSync(UsersPageQuery)({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("takes a page from 1, and a size from 1 to 100, in whole numbers", () => {
    expect(decode({ page: 1, pageSize: 1 })._tag).toBe("Some");
    expect(decode({ page: 7, pageSize: 100 })._tag).toBe("Some");
    expect(decode({ page: 0 })._tag).toBe("None");
    expect(decode({ pageSize: 0 })._tag).toBe("None");
    expect(decode({ pageSize: 101 })._tag).toBe("None");
    expect(decode({ page: 1.5 })._tag).toBe("None");
  });
});
