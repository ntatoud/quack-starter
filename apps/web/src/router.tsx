import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "#/routeTree.gen.ts";

/** What every route finds in its `context`, before a `beforeLoad` adds to it. */
export interface RouterContext {
  readonly queryClient: QueryClient;
}

export function getRouter() {
  // One client per router: on the server that is one per request, so no cache is shared between users.
  const queryClient = new QueryClient();

  return createRouter({
    routeTree,
    // The same client as the components': a `beforeLoad` reads and fills the cache they use.
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
