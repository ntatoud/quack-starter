import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";

import { dataTableSearchSchema } from "#/components/data-table/search-schema.ts";

const schema = dataTableSearchSchema({
  columns: ["name", "price"],
  filters: {
    category: Schema.Literals(["hardware", "software"]),
    tags: Schema.Array(Schema.Literals(["new", "sale"])),
  },
});

describe("dataTableSearchSchema", () => {
  it("leaves out the keys the URL leaves out, and drops keys it does not know", () => {
    expect(Schema.decodeUnknownSync(schema)({})).toEqual({});
    expect(Schema.decodeUnknownSync(schema)({ other: "x" })).toEqual({});
  });

  it("keeps valid values", () => {
    const search = {
      page: 3,
      q: "desk",
      orderBy: "price",
      dir: "desc",
      hidden: ["price"],
      category: "software",
      tags: ["new", "sale"],
    };

    expect(Schema.decodeUnknownSync(schema)(search)).toEqual(search);
  });

  it("drops an invalid page, sorting, or direction to its default", () => {
    expect(Schema.decodeUnknownSync(schema)({ page: 0 })).toEqual({ page: undefined });
    expect(Schema.decodeUnknownSync(schema)({ page: 1.5 })).toEqual({ page: undefined });
    expect(Schema.decodeUnknownSync(schema)({ page: "two" })).toEqual({ page: undefined });
    expect(Schema.decodeUnknownSync(schema)({ orderBy: "category" })).toEqual({
      orderBy: undefined,
    });
    expect(Schema.decodeUnknownSync(schema)({ dir: "up" })).toEqual({ dir: undefined });
  });

  it("reads a search the router parsed as a number or a boolean as text", () => {
    expect(Schema.decodeUnknownSync(schema)({ q: 42 })).toEqual({ q: "42" });
    expect(Schema.decodeUnknownSync(schema)({ q: true })).toEqual({ q: "true" });
    expect(Schema.decodeUnknownSync(schema)({ q: { nested: 1 } })).toEqual({ q: undefined });
  });

  it("clears a filter or hidden columns that do not validate", () => {
    expect(Schema.decodeUnknownSync(schema)({ category: "food" })).toEqual({
      category: undefined,
    });
    expect(Schema.decodeUnknownSync(schema)({ tags: ["new", "old"] })).toEqual({
      tags: undefined,
    });
    expect(Schema.decodeUnknownSync(schema)({ hidden: "price" })).toEqual({ hidden: undefined });
  });
});

describe("dataTableSearchSchema page size", () => {
  const sized = dataTableSearchSchema({
    columns: ["name"],
    pageSizes: [10, 25, 50],
  });

  it("keeps a size the table offers, and drops any other", () => {
    expect(Schema.decodeUnknownSync(sized)({ size: 25 })).toEqual({ size: 25 });
    expect(Schema.decodeUnknownSync(sized)({ size: 33 })).toEqual({ size: undefined });
    expect(Schema.decodeUnknownSync(sized)({ size: "many" })).toEqual({ size: undefined });
  });

  it("keeps any positive whole size when the table names none", () => {
    expect(Schema.decodeUnknownSync(schema)({ size: 33 })).toEqual({ size: 33 });
    expect(Schema.decodeUnknownSync(schema)({ size: 0 })).toEqual({ size: undefined });
    expect(Schema.decodeUnknownSync(schema)({ size: 100_000 })).toEqual({ size: undefined });
  });
});

describe("dataTableSearchSchema search", () => {
  it("reads a search of blanks as none", () => {
    expect(Schema.decodeUnknownSync(schema)({ q: "  " })).toEqual({ q: undefined });
    expect(Schema.decodeUnknownSync(schema)({ q: "" })).toEqual({ q: undefined });
    expect(Schema.decodeUnknownSync(schema)({ q: " ada " })).toEqual({ q: " ada " });
  });
});
