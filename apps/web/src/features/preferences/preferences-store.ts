import { queryOptions } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import type { PreferenceValues } from "#/features/preferences/preferences.ts";

/** Where the Preferences of this device are kept. `read` runs in the server render too. */
export interface PreferencesStore {
  read(): PreferenceValues;
  write(values: PreferenceValues): void;
}

export const PreferencesStoreContext = createContext<PreferencesStore | null>(null);

export const usePreferencesStore = (): PreferencesStore => {
  const store = useContext(PreferencesStoreContext);
  if (store === null) throw new Error("usePreferencesStore needs a PreferencesStoreContext.");
  return store;
};

/** Read once, then kept up to date by whoever writes the store. */
export const preferencesQueryOptions = (store: PreferencesStore) =>
  queryOptions({
    queryKey: ["preferences"],
    queryFn: () => store.read(),
    staleTime: Number.POSITIVE_INFINITY,
  });
