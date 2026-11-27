import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, type RouterHistory } from "@tanstack/react-router";

import { setCurrentUserData } from "#/features/identity/current-user.ts";
import { signInLocation } from "#/features/identity/redirect-target.ts";
import {
  cookiePreferences,
  type Preferences,
  PreferencesContext,
} from "#/features/preferences/preferences.ts";
import { routeTree } from "#/routeTree.gen.ts";

export interface RouterContext {
  readonly queryClient: QueryClient;
}

// A call without a Session would fail again: retrying only delays the sign-in page.
const retry = (failureCount: number, error: Error): boolean =>
  !(error instanceof Unauthenticated) && failureCount < 3;

/** A test passes its own history and Preferences, which then live in memory, not in the URL bar and the cookies. */
export interface RouterOptions {
  readonly history?: RouterHistory;
  readonly preferences?: Preferences;
}

export function getRouter({ history, preferences = cookiePreferences() }: RouterOptions = {}) {
  const onError = (error: Error): void => {
    if (!(error instanceof Unauthenticated)) return;
    setCurrentUserData(queryClient, null);
    const { pathname, href } = router.state.location;
    const signIn = signInLocation(href);

    // Several calls can fail at once: the first one already led to the sign-in page.
    if (pathname === signIn.to) return;
    void router.navigate(signIn);
  };

  // One client per router: on the server that is one per request, so no cache is shared between users.
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: { queries: { retry } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <PreferencesContext value={preferences}>{children}</PreferencesContext>
      </QueryClientProvider>
    ),
  });

  if (history !== undefined) router.update({ ...router.options, history });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
