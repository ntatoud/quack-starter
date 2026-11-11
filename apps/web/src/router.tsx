import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { setCurrentUserData } from "#/features/identity/current-user.ts";
import { signInLocation } from "#/features/identity/redirect-target.ts";
import { routeTree } from "#/routeTree.gen.ts";

/** What every route finds in its `context`, before a `beforeLoad` adds to it. */
export interface RouterContext {
  readonly queryClient: QueryClient;
}

// A call the API refused for want of a Session is refused again: retrying it only delays the sign-in page.
const retry = (failureCount: number, error: unknown): boolean =>
  !(error instanceof Unauthenticated) && failureCount < 3;

export function getRouter() {
  // Every query and every mutation of the app ends here when it fails.
  // `Unauthenticated` means the Session ended while the app was in use: there is no Current User anymore,
  // so the User signs in again, and comes back to the page they were on.
  const onError = (error: unknown): void => {
    if (!(error instanceof Unauthenticated)) return;
    setCurrentUserData(queryClient, null);
    const { pathname, href } = router.state.location;
    // Several calls can fail at once: the first one already led to the sign-in page.
    const signIn = signInLocation(href);
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
    // The same client as the components': a `beforeLoad` reads and fills the cache they use.
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
