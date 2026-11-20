import { Schema } from "effect";

import { definePreference, definePreferences } from "#/features/preferences/define-preference.ts";

export const Preferences = definePreferences({
  "right-sidebar": definePreference(Schema.Boolean, false),
});

export type PreferenceValues = typeof Preferences.Values.Type;
export type PreferenceKey = keyof PreferenceValues;
