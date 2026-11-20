import appCss from "@quack/ui/globals.css?url";
import { createRootRouteWithContext } from "@tanstack/react-router";

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { pageTitle } from "#/features/layout/page-title.ts";
import { NotFound } from "#/features/layout/not-found.tsx";
import { RootDocument } from "#/features/layout/root-document.tsx";
import { preferencesQueryOptions } from "#/features/preferences/preferences-store.ts";
import type { RouterContext } from "#/router.tsx";

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    // Read before the first render, the server one included, so the page is drawn as the browser will.
    await context.queryClient.ensureQueryData(preferencesQueryOptions(context.preferencesStore));
    return { currentUser: await context.queryClient.ensureQueryData(currentUserQueryOptions) };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: pageTitle() },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});
