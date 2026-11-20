import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { definePreference, definePreferences } from "#/features/preferences/define-preference.ts";
import { Preferences } from "#/features/preferences/preferences.ts";

const kebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("Preferences", () => {
  it.each(Object.keys(Preferences.defaults))("names %s in kebab-case", (key) => {
    expect(key).toMatch(kebabCase);
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

  it("decodes what a store kept", () => {
    expect(preferences.decodeWithDefaults({ "text-size": "lg", "beta-stats": true })).toEqual({
      "text-size": "lg",
      "beta-stats": true,
    });
  });

  it("gives the default of each value missing, and keeps the others", () => {
    expect(preferences.decodeWithDefaults({ "beta-stats": true })).toEqual({
      "text-size": "md",
      "beta-stats": true,
    });
  });

  it("gives the default of a value that no longer decodes, and keeps the others", () => {
    expect(preferences.decodeWithDefaults({ "text-size": "xl", "beta-stats": true })).toEqual({
      "text-size": "md",
      "beta-stats": true,
    });
  });

  it("ignores a key it no longer declares", () => {
    expect(preferences.decodeWithDefaults({ "removed-preference": true })).toEqual(
      preferences.defaults,
    );
  });

  it.each([undefined, null, "left", 42, ["lg"]])("gives the defaults for %j", (stored) => {
    expect(preferences.decodeWithDefaults(stored)).toEqual(preferences.defaults);
  });
});
