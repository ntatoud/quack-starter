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

// The router hands `validateSearch` whatever it parsed from the URL.
const decode = Schema.decodeUnknownSync(schema);

describe("dataTableSearchSchema", () => {
  it("leaves out the keys the URL leaves out, and drops keys it does not know", () => {
    expect(decode({})).toEqual({});
    expect(decode({ other: "x" })).toEqual({});
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

    expect(decode(search)).toEqual(search);
  });

  it("drops an invalid page, sorting, or direction to its default", () => {
    expect(decode({ page: 0 })).toEqual({ page: undefined });
    expect(decode({ page: 1.5 })).toEqual({ page: undefined });
    expect(decode({ page: "two" })).toEqual({ page: undefined });
    expect(decode({ orderBy: "category" })).toEqual({
      orderBy: undefined,
    });
    expect(decode({ dir: "up" })).toEqual({ dir: undefined });
  });

  it("reads a search the router parsed as a number or a boolean as text", () => {
    expect(decode({ q: 42 })).toEqual({ q: "42" });
    expect(decode({ q: true })).toEqual({ q: "true" });
    expect(decode({ q: { nested: 1 } })).toEqual({ q: undefined });
  });

  it("clears a filter or hidden columns that do not validate", () => {
    expect(decode({ category: "food" })).toEqual({
      category: undefined,
    });
    expect(decode({ tags: ["new", "old"] })).toEqual({
      tags: undefined,
    });
    expect(decode({ hidden: "price" })).toEqual({ hidden: undefined });
  });
});

describe("dataTableSearchSchema page size", () => {
  const sized = dataTableSearchSchema({
    columns: ["name"],
    pageSizes: [10, 25, 50],
  });

  const decodeSized = Schema.decodeUnknownSync(sized);

  it("keeps a size the table offers, and drops any other", () => {
    expect(decodeSized({ size: 25 })).toEqual({ size: 25 });
    expect(decodeSized({ size: 33 })).toEqual({ size: undefined });
    expect(decodeSized({ size: "many" })).toEqual({ size: undefined });
  });

  it("keeps any positive whole size when the table names none", () => {
    expect(decode({ size: 33 })).toEqual({ size: 33 });
    expect(decode({ size: 0 })).toEqual({ size: undefined });
    expect(decode({ size: 100_000 })).toEqual({ size: undefined });
  });
});

describe("dataTableSearchSchema search", () => {
  it("reads a search of blanks as none", () => {
    expect(decode({ q: "  " })).toEqual({ q: undefined });
    expect(decode({ q: "" })).toEqual({ q: undefined });
    expect(decode({ q: " ada " })).toEqual({ q: " ada " });
  });
});
