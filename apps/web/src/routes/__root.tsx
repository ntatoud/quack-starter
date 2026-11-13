import appCss from "@quack/ui/globals.css?url";
import { createRootRouteWithContext } from "@tanstack/react-router";

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { NotFound } from "#/features/layout/not-found.tsx";
import { RootDocument } from "#/features/layout/root-document.tsx";
import { RootLayout } from "#/features/layout/root-layout.tsx";
import type { RouterContext } from "#/router.tsx";

export const Route = createRootRouteWithContext<RouterContext>()({
  // Runs before every navigation, in the server render and in the browser, so every route knows the Current User.
  // The cache answers once it is filled: only the first navigation of a page asks the server.
  beforeLoad: async ({ context }) => ({
    currentUser: await context.queryClient.ensureQueryData(currentUserQueryOptions),
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Quack Starter" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
  component: RootLayout,
});
