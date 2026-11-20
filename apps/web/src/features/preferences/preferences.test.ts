import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { definePreference, definePreferences } from "#/features/preferences/preference.ts";
import { Preferences } from "#/features/preferences/preferences.ts";

const kebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("Preferences", () => {
  it.each(Preferences.keys)("names %s in kebab-case", (key) => {
    expect(key).toMatch(kebabCase);
  });

  it("gives each Preference its default value", () => {
    expect(Preferences.defaults).toEqual({ "right-sidebar": false });
  });
});

describe("definePreferences", () => {
  const preferences = definePreferences({
    "text-size": definePreference(Schema.Literals(["sm", "md", "lg"]), "md"),
    "beta-stats": definePreference(Schema.Boolean, false),
  });

  it("refuses values that miss a Preference", () => {
    expect(() => Schema.decodeUnknownSync(preferences.Values)({ "text-size": "lg" })).toThrow();
  });

  it("resolves what a store kept", () => {
    expect(preferences.resolve({ "text-size": "lg", "beta-stats": true })).toEqual({
      "text-size": "lg",
      "beta-stats": true,
    });
  });

  it("resolves each value missing to its default, and keeps the others", () => {
    expect(preferences.resolve({ "beta-stats": true })).toEqual({
      "text-size": "md",
      "beta-stats": true,
    });
  });

  it("resolves a value that no longer decodes to its default, and keeps the others", () => {
    expect(preferences.resolve({ "text-size": "xl", "beta-stats": true })).toEqual({
      "text-size": "md",
      "beta-stats": true,
    });
  });

  it("ignores a key it no longer declares", () => {
    expect(preferences.resolve({ "removed-preference": true })).toEqual(preferences.defaults);
  });

  it.each([undefined, null, "left", 42, ["lg"]])("resolves %j to the defaults", (stored) => {
    expect(preferences.resolve(stored)).toEqual(preferences.defaults);
  });
});
