import { rightSidebar } from "#/features/preferences/layout-preferences.ts";
import { definePreferences } from "#/features/preferences/preference.ts";

export const Preferences = definePreferences({
  "right-sidebar": rightSidebar,
});

export type PreferenceValues = typeof Preferences.Values.Type;
export type PreferenceKey = keyof PreferenceValues;
