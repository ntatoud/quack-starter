import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import type { PreferenceKey, PreferenceValues } from "#/features/preferences/preferences.ts";
import {
  preferencesQueryOptions,
  usePreferencesStore,
} from "#/features/preferences/preferences-store.ts";

export function usePreferences(): PreferenceValues {
  return useSuspenseQuery(preferencesQueryOptions(usePreferencesStore())).data;
}

export function usePreference<K extends PreferenceKey>(key: K): PreferenceValues[K] {
  return usePreferences()[key];
}

export function useSavePreferences() {
  const store = usePreferencesStore();
  const queryClient = useQueryClient();

  return (values: PreferenceValues) => {
    store.write(values);
    queryClient.setQueryData(preferencesQueryOptions(store).queryKey, values);
  };
}
