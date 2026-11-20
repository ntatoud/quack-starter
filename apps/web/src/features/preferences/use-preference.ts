import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PreferenceKey, PreferenceValues } from "#/features/preferences/preferences.ts";
import {
  preferencesQueryOptions,
  usePreferencesStore,
} from "#/features/preferences/preferences-store.ts";

export function usePreferences(): PreferenceValues {
  const store = usePreferencesStore();
  // The browser starts with an empty cache: reading the store there draws what the server drew, with no suspense.
  return useQuery({ ...preferencesQueryOptions(store), initialData: () => store.read() }).data;
}

export function usePreference<K extends PreferenceKey>(key: K): PreferenceValues[K] {
  return usePreferences()[key];
}

/** Changes one Preference over what the store holds now, so it keeps a change made meanwhile, in another tab too. */
export function useSetPreference() {
  const store = usePreferencesStore();
  const queryClient = useQueryClient();

  return <K extends PreferenceKey>(key: K, value: PreferenceValues[K]) => {
    const values = { ...store.read(), [key]: value };
    store.write(values);
    queryClient.setQueryData(preferencesQueryOptions(store).queryKey, values);
  };
}
