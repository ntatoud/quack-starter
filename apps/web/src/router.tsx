import { Unauthenticated } from "@quack/contracts/identity/identity-errors";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { setCurrentUserData } from "#/features/identity/current-user.ts";
import { routeTree } from "#/routeTree.gen.ts";

/** What every route finds in its `context`, before a `beforeLoad` adds to it. */
export interface RouterContext {
  readonly queryClient: QueryClient;
}

const signInPath = "/sign-in";

export function getRouter() {
  // Every query and every mutation of the app ends here when it fails.
  // `Unauthenticated` means the Session ended while the app was in use: there is no Current User anymore,
  // so the User signs in again, and comes back to the page they were on.
  const onError = (error: unknown): void => {
    if (!(error instanceof Unauthenticated)) return;
    setCurrentUserData(queryClient, null);
    const { pathname, href } = router.state.location;
    // Several calls can fail at once: the first one already led to the sign-in page.
    if (pathname === signInPath) return;
    void router.navigate({ to: signInPath, search: { redirect: href } });
  };

  // One client per router: on the server that is one per request, so no cache is shared between users.
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
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
