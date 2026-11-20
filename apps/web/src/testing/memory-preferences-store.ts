import { type PreferenceValues, Preferences } from "#/features/preferences/preferences.ts";
import type { PreferencesStore } from "#/features/preferences/preferences-store.ts";

export const memoryPreferencesStore = (initial: Partial<PreferenceValues> = {}) => {
  let values: PreferenceValues = { ...Preferences.defaults, ...initial };
  const store: PreferencesStore = {
    read: () => values,
    write: (written) => {
      values = written;
    },
  };
  return store;
};
