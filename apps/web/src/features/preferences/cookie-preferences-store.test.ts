import { describe, expect, it } from "vite-plus/test";

import {
  serializePreferencesCookie,
  parsePreferencesCookie,
} from "#/features/preferences/cookie-preferences-store.ts";
import { Preferences } from "#/features/preferences/preferences.ts";

const right = { ...Preferences.defaults, "right-sidebar": true };

const valueOf = (cookie: string) =>
  decodeURIComponent(cookie.split("; ")[0]?.slice("preferences=".length) ?? "");

describe("the cookie of the Preferences", () => {
  it("gives back the values written", () => {
    expect(
      parsePreferencesCookie(valueOf(serializePreferencesCookie(right, { secure: true }))),
    ).toEqual(right);
  });

  it("lasts a year on every page, and is Secure on https only", () => {
    expect(serializePreferencesCookie(right, { secure: true })).toMatch(
      /; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/,
    );
    expect(serializePreferencesCookie(right, { secure: false })).not.toMatch(/Secure/);
  });

  it.each([undefined, "", "not json", "{", '"right"'])(
    "gives the defaults for a cookie %j it cannot read",
    (value) => {
      expect(parsePreferencesCookie(value)).toEqual(Preferences.defaults);
    },
  );

  it("gives the default of a value that no longer decodes, and keeps the others", () => {
    expect(parsePreferencesCookie('{"right-sidebar":"yes"}')).toEqual(Preferences.defaults);
  });
});
