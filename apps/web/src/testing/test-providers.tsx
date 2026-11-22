import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import {
  createPreferences,
  type PreferenceValues,
  PreferencesContext,
} from "#/features/preferences/preferences.ts";

export const testProviders = (values: Partial<PreferenceValues> = {}) => {
  const queryClient = new QueryClient();
  const preferences = createPreferences();

  if (values.colorScheme !== undefined) preferences.colorScheme.set(values.colorScheme);

  if (values.sidebarSide !== undefined) preferences.sidebarSide.set(values.sidebarSide);

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <PreferencesContext value={preferences}>{children}</PreferencesContext>
      </QueryClientProvider>
    );
  }

  return { queryClient, preferences, Providers };
};
