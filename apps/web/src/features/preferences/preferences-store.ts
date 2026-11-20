import { queryOptions } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import type { PreferenceValues } from "#/features/preferences/preferences.ts";

/** `read` runs in the server render too; `write` runs in the browser only, on what a user does. */
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

export const preferencesQueryKey = ["preferences"] as const;

export const preferencesQueryOptions = (store: PreferencesStore) =>
  queryOptions({
    queryKey: preferencesQueryKey,
    queryFn: () => store.read(),
    staleTime: Number.POSITIVE_INFINITY,
  });
