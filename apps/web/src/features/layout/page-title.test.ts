import { brand } from "@quack/brand/brand";
import { describe, expect, it } from "vite-plus/test";

import { pageTitle } from "#/features/layout/page-title.ts";

describe("pageTitle", () => {
  it("ends with the name of the app", () => {
    expect(pageTitle("Todos")).toBe(`Todos | ${brand.pageTitleSuffix}`);
  });

  it("names the most specific first", () => {
    expect(pageTitle("Noé Tatoud", "Profile")).toBe(
      `Noé Tatoud | Profile | ${brand.pageTitleSuffix}`,
    );
  });

  it("is the name of the app alone with no segment", () => {
    expect(pageTitle()).toBe(brand.pageTitleSuffix);
  });

  it("drops a blank segment", () => {
    expect(pageTitle(" ", "Profile")).toBe(`Profile | ${brand.pageTitleSuffix}`);
  });
});
