import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { PageQuery } from "#/pagination/page.ts";

describe("PageQuery", () => {
  const decode = Schema.decodeUnknownOption(PageQuery);

  it("asks for the first page of 20 when the query says nothing", () => {
    expect(Schema.decodeUnknownSync(PageQuery)({})).toEqual({ page: 1, pageSize: 20 });
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
