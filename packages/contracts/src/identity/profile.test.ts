import { Option, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { CountryCode } from "#/identity/profile.ts";

describe("CountryCode", () => {
  const decode = Schema.decodeUnknownOption(CountryCode);

  it("accepts a code assigned to a country or territory", () => {
    expect(decode("FR")).toEqual(Option.some("FR"));
    expect(decode("AQ")).toEqual(Option.some("AQ"));
  });

  it("refuses a code of two capital letters that no country has", () => {
    expect(decode("ZZ")).toEqual(Option.none());
    expect(decode("UK")).toEqual(Option.none());
  });

  it("refuses a code in lowercase", () => {
    expect(decode("fr")).toEqual(Option.none());
  });
});
