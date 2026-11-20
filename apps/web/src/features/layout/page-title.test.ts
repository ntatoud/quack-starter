import { describe, expect, it } from "vite-plus/test";

import { appName, pageTitle } from "#/features/layout/page-title.ts";

describe("pageTitle", () => {
  it("ends with the name of the app", () => {
    expect(pageTitle("Todos")).toBe(`Todos | ${appName}`);
  });

  it("names the most specific first", () => {
    expect(pageTitle("Noé Tatoud", "Profile")).toBe(`Noé Tatoud | Profile | ${appName}`);
  });

  it("is the name of the app alone with no segment", () => {
    expect(pageTitle()).toBe(appName);
  });

  it("drops a blank segment", () => {
    expect(pageTitle(" ", "Profile")).toBe(`Profile | ${appName}`);
  });
});
