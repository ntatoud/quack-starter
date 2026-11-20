import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { PreferenceValues } from "#/features/preferences/preferences.ts";
import {
  preferencesQueryOptions,
  PreferencesStoreContext,
} from "#/features/preferences/preferences-store.ts";
import { memoryPreferencesStore } from "#/testing/memory-preferences-store.ts";

export const testProviders = (preferences: Partial<PreferenceValues> = {}) => {
  const queryClient = new QueryClient();
  const preferencesStore = memoryPreferencesStore(preferences);
  queryClient.setQueryData(
    preferencesQueryOptions(preferencesStore).queryKey,
    preferencesStore.read(),
  );

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <PreferencesStoreContext value={preferencesStore}>{children}</PreferencesStoreContext>
      </QueryClientProvider>
    );
  }

  return { queryClient, preferencesStore, Providers };
};
